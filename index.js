const sessionName = "yusril";
const donet = "https://saweria.co/sansekai";
const owner = ["6287878817169"]; // Put your number here ex: ["62xxxxxxxxx"]
const {
  default: sansekaiConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers, 
  fetchLatestWaWebVersion
} = require("@adiwajshing/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const chalk = require("chalk");
const figlet = require("figlet");
const _ = require("lodash");

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

async function startHisoka() {
  const { state, saveCreds } = await useMultiFileAuthState(`./${sessionName ? sessionName : "session"}`);
  const { version, isLatest } = await fetchLatestWaWebVersion().catch(() => fetchLatestBaileysVersion());
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(
    color(
      figlet.textSync("Checker No WA - Sansekai", {
        font: "Small",
        horizontalLayout: "default",
        vertivalLayout: "default",
        whitespaceBreak: false,
      }),
      "green"
    )
  );

  const client = sansekaiConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    browser: Browsers.macOS('Desktop'),
    auth: state,
  });

  store.bind(client.ev);

  client.ev.on("messages.upsert", async (message) => {
    //console.log(JSON.stringify(chatUpdate, undefined, 2))
    try {
        const list_nomor = JSON.parse(fs.readFileSync("./list-nomor.json")) // tempat nomor yang mau di cek (list nomor)
        const nomor_aktif = JSON.parse(fs.readFileSync("./nomor-aktif.json")) // tempat menyimpan hasil nomor yang aktif (list nomor)
        const nomor_tidak_aktif = JSON.parse(fs.readFileSync("./nomor-tidak-aktif.json")) // tempat menyimpan hasil nomor yang tidak aktif (list nomor)
      //let cek = await client.onWhatsApp("628128468899@s.whatsapp.net");
      console.log(`Total nomor yang ada di list-nomor.json ${list_nomor.length}`)
      for (let i of list_nomor) {
        let cek = await client.onWhatsApp(`${i}@s.whatsapp.net`);
        if (cek.length == 0) {
          console.log(color(`Nomor wa.me/${i.replace("@s.whatsapp.net", "")} tidak aktif`, "red"));
          // nomor_tidak_aktif.push(i.replace("@s.whatsapp.net", "@c.us"));
          nomor_tidak_aktif.push(i);
        fs.writeFile('./nomor-tidak-aktif.json', JSON.stringify(nomor_tidak_aktif), (err) => {
          if (err) {
              console.log('Terjadi kesalahan saat menyimpan data ke file JSON:', err);
          } else {
              // console.log('Data berhasil disimpan ke file JSON.');
              console.log(color(`Nomor ${i} berhasil disimpan ke file nomor-tidak-aktif.json`, "red"));
          }
      });
        } else {
          // console.log(`Nomor ${i} aktif`)
          console.log(color(`Nomor ${i} aktif`, "green"));
        // nomor_aktif.push(i.replace("@s.whatsapp.net", "@c.us"));
        nomor_aktif.push(i);
        fs.writeFile('./nomor-aktif.json', JSON.stringify(nomor_aktif), (err) => {
          if (err) {
              console.error('Terjadi kesalahan saat menyimpan data ke file JSON:', err);
          } else {
              // console.log('Data berhasil disimpan ke file JSON.');
              console.log(color(`Nomor ${i} berhasil disimpan ke file nomor-aktif.json`, "green"));
          }
      });
        }
      }
      console.log(color(`Jumlah nomor aktif: ${nomor_aktif.length}`, "green"));
      console.log(color(`Jumlah nomor tidak aktif: ${nomor_tidak_aktif.length}`, "red"));
    } catch (err) {
      console.log(err);
    }
  });

  // Handle error
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function (err) {
    console.log("Caught exception: ", err);
  });

  // Setting

  client.public = true;

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        process.exit();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        startHisoka();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        startHisoka();
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection Replaced, Another New Session Opened, Please Restart Bot");
        process.exit();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Delete Folder Session yusril and Scan Again.`);
        process.exit();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restart Required, Restarting...");
        startHisoka();
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        startHisoka();
      } else {
        console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
        startHisoka();
      }
    } else if (connection === "open") {
      console.log(color("Bot success conneted to server", "green"));
      console.log(color("Donate for creator https://saweria.co/sansekai", "yellow"));
      client.sendMessage(owner + "@s.whatsapp.net", { text: `Bot started!\n\njangan lupa support ya bang :)\n${donet}` });
    }
    // console.log('Connected...', update)
  });

  client.ev.on("creds.update", saveCreds);

  return client;
}

startHisoka();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
