require('dotenv').config()
const fs = require('fs');
const path = require('path')
const https = require('https')
const { spawnSync } = require('child_process')
const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env.BOT_TOKEN);
const download = require('download');
const Database = require('better-sqlite3');
const db = new Database('images.db', { verbose: console.log });


const pathToSemgmentateScript = path.join(__dirname, "python_env/segmentation.py")

// Windows
const pathToPython = path.join(__dirname, "python_env/venv/Scripts/python.exe")
// Linux
// const pathToPython = path.join(__dirname, "python_env/venv/bin/python")


initDirs()
initDB()

let optionalParams = {
  parse_mode: 'Markdown',
  reply_markup: JSON.stringify({
    inline_keyboard: [[
      { text: 'Help 🆘', callback_data: 'help' },
      { text: 'Statistics 📊', callback_data: 'statistics' },
    ]]
  })
}

const HELP_TEXT = `This is segmentation bot 🦾. Send me image 🏜 as a file and you will get segmentated image 🗺`

slimbot.on('callback_query', query => {
  if (query.data === 'help') {
    slimbot.sendMessage(query.message.chat.id, HELP_TEXT)
  }
  if (query.data === 'statistics') {
    const row = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(query.message.chat.id)
    const numOfImg = db.prepare("SELECT COUNT(*) FROM images WHERE telegram_id = ?").get(query.message.chat.id)
    slimbot.sendMessage(query.message.chat.id, `Rigistration date: ${row.date}\nUser name: ${row.username}\nLoaded images: ${numOfImg['COUNT(*)']}`)
  }
});

slimbot.on('message', async (message) => {
  if (message.text) {
    if(message.text === "/help" || message.text === "help") {
      slimbot.sendMessage(message.chat.id, HELP_TEXT, optionalParams)
    }
    if(message.text === "/start" || message.text === "start") {
      addUserIfNotExist(message.chat.id.toString(), message.chat.first_name)
    }
  }
  if(!checkIfUserInDB(message.chat.id)) {
    slimbot.sendMessage(message.chat.id, "Type /start to start using this bot")
    return
  }

  if(message.photo) {
    slimbot.sendMessage(message.chat.id, "Don't send photos! Send file! Photos won't work! If you send from computer send without compression.")
  }

  if(message.document) {
    
    let segmentSize = '8'
    if (message.caption) {
      let maybeSegment = parseInt(message.caption)
      if (maybeSegment) {
        if (maybeSegment > 100) maybeSegment = 100
        if (maybeSegment < 2) maybeSegment = 2
        segmentSize = maybeSegment.toString()
      }
    }
    const file_path = await getFilePath(message.document.file_id)
    const imageFileName = await saveFile(file_path, message.document.mime_type)
    const insertedFileId = saveRawImageToDb(imageFileName, message.chat.id.toString())
    const segmentedImageFileName = segmentateFileByPythonScript(imageFileName, segmentSize, insertedFileId)
    saveSegmentedImageToDb(insertedFileId, segmentedImageFileName, segmentSize)
    sendResultBackToUser(segmentedImageFileName, message.chat.id)
  }
});


slimbot.startPolling();

function initDirs() {
  fs.mkdir("./images/result", { recursive: true }, (err) => {
    if (err) console.log(err)
    console.log("Directory /images is created.");
  });
}

function initDB() {
  const initialSql = fs.readFileSync('./init.sql', 'utf8');
  db.exec(initialSql);
}

async function getFilePath(fileId) {
  let file = await slimbot.getFile(fileId)
  return file.result.file_path
}

async function saveFile(filePath, mimeType) {
  let url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`
  let time = Date.now()
  let fileExtension = ''

  if(mimeType === 'image/jpeg') fileExtension = "jpg"
  if(mimeType === 'image/png') fileExtension = "png"

  const pathResult = `${__dirname}/images/image-${time}.${fileExtension}`;
  fs.writeFileSync(pathResult, await download(url));
  
  return path.basename(pathResult)
}

function segmentateFileByPythonScript(imageFileName, sizeOfSegment = '8', insertedImageId = '1') {
  const python = spawnSync(pathToPython, [pathToSemgmentateScript, imageFileName, sizeOfSegment, insertedImageId]);
  if(python.status) {
    console.log("Error: " , python.stderr.toString());
    return
  }
  resultFileName = python.stdout.toString()
  return resultFileName
}

function sendResultBackToUser(fileName, user_id) {
  let inputFile = fs.createReadStream(__dirname + '/images/result/' + fileName);
  console.log("Sending file to user");
  slimbot.sendDocument(user_id, inputFile).then(message => {
    console.log("File has been send");
  });
}

function addUserIfNotExist(userId, userName) {
  const row = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(userId)
  if (row) {
    slimbot.sendMessage(userId, HELP_TEXT, optionalParams)
    return
  }
  const info = db.prepare("INSERT INTO users(username, telegram_id, date, role) VALUES(?, ?, datetime('now'), 0)").run(userName, userId)
  console.log(info);
  slimbot.sendMessage(userId, HELP_TEXT, optionalParams)
}

function checkIfUserInDB(user_id) {
  const row = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(user_id)
  if (row) return true
  else return false
}

function saveRawImageToDb(fileName, telegramId) {
  const info = db.prepare("INSERT INTO images(file_name, telegram_id, date) VALUES(?, ?, datetime('now'))").run(fileName, telegramId)
  console.log(info)
  return info.lastInsertRowid
}
function saveSegmentedImageToDb(image_id, file_name, segment_size) {
  const info = db.prepare("INSERT INTO result(image_id, file_name, segment_size, date) VALUES(?, ?, ?, datetime('now'))").run(image_id, file_name, segment_size)
}

