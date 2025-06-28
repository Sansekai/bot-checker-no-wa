import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidDecode,
  Browsers
} from "baileys";
import Pino from "pino";
import fs from "fs";
import chalk from "chalk";
import qrcode from "qrcode-terminal"
import NodeCache from '@cacheable/node-cache'

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

const logger = Pino({
    level: "silent"
});

const groupCache = new NodeCache()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectToWhatsApp() {
	const { state, saveCreds } = await useMultiFileAuthState(`./session`);
  const { version } = await fetchLatestBaileysVersion();
	const sock = makeWASocket({
   auth: {
     creds: state.creds,
     keys: makeCacheableSignalKeyStore(state.keys, logger),
   },
        //qrTimeout: 30_000,
        //connectTimeoutMs: 30_000,
        //keepAliveIntervalMs: 30_000,
   retryRequestDelayMs: 300,
   maxMsgRetryCount: 10,
   version: version,
   logger: logger,
  //  printQRInTerminal: true,
        //defaultQueryTimeoutMs: undefined,
        markOnlineOnConnect: true,
   generateHighQualityLinkPreview: true,
   //syncFullHistory: false,
        //emitOwnEvents: false,
   //...(use_pairing_code ? { browser: Browsers.macOS('Desktop') } : {}),
   browser: Browsers.macOS('Chrome'),
   cachedGroupMetadata: async (jid) => groupCache.get(jid)
   /*shouldIgnoreJid: (jid) => {
     !jid || isJidBroadcast(jid) || jid.includes('newsletter')
   }*/
 });

		sock.ev.process(async (ev) => {
    if (ev["connection.update"]) {
      const update = ev["connection.update"];
      const { connection, lastDisconnect } = update;
      const status = lastDisconnect?.error?.output?.statusCode;
      // console.log(update.qr);
      if (update.qr) {
        qrcode.generate(update.qr, {small: true}, function (qrcode) {
          console.log(qrcode)
      });
    }

        if (connection === 'close') {
            const reason = Object.entries(DisconnectReason).find(i => i[1] === status)?.[0] || 'unknown';

            console.log(`session | Closed connection, status: ${reason} (${status})`);
            
            switch (reason) {
        case "multideviceMismatch":
        case "loggedOut":
          console.error(lastDisconnect.error);
          //await sock.logout();
          fs.rmSync(`./session`, { recursive: true, force: true });
          /*exec('npm run stop:pm2', err => {
            if (err) return treeKill(process.pid);
          });*/
          break;
        default:
        if (status === 403) {
          //console.error(lastDisconnect.error?.message);
          console.error(lastDisconnect.error);
          //await sock.logout();
          fs.rmSync(`./session`, { recursive: true, force: true });
          } else {
          console.error(lastDisconnect.error?.message);
          connectToWhatsApp();
          }
      }

            /*if (status !== 403 || status !== 401) {
                return connectToWhatsApp();
            }
            
            console.log(`sansekai${index} logout`);
            await sock.logout();
      fs.rmSync(`./sansekai${index}`, { recursive: true, force: true });*/
        } else if (connection === 'open') {
            console.log(`session Connected: ${jidDecode(sock?.user?.id)?.user}`);
        }
    }
    if (ev["creds.update"]) {
      await saveCreds();
    }
    // sock.ev.on("messages.upsert", async (message) => { 
    //   console.log(message);
    // })
    
    const upsert = ev["messages.upsert"];
if (upsert) {
  try {
    const list_nomor = JSON.parse(fs.readFileSync("./list-nomor.json")); // tempat nomor yang mau di cek (list nomor)
    const nomor_aktif = JSON.parse(fs.readFileSync("./nomor-aktif.json")); // tempat menyimpan hasil nomor yang aktif (list nomor)
    const nomor_tidak_aktif = JSON.parse(fs.readFileSync("./nomor-tidak-aktif.json")); // tempat menyimpan hasil nomor yang tidak aktif (list nomor)
    
    console.log(`Total nomor yang ada di list-nomor.json ${list_nomor.length}`);
    
    for (let i of list_nomor) {
        let cek = await sock.onWhatsApp(`${i}@s.whatsapp.net`);
        
        if (cek.length == 0) {
            console.log(color(`Nomor wa.me/${i.replace("@s.whatsapp.net", "")} tidak aktif`, "red"));
            nomor_tidak_aktif.push(i);
            fs.writeFile('./nomor-tidak-aktif.json', JSON.stringify(nomor_tidak_aktif), (err) => {
                if (err) {
                    console.log('Terjadi kesalahan saat menyimpan data ke file JSON:', err);
                } else {
                    console.log(color(`Nomor ${i} berhasil disimpan ke file nomor-tidak-aktif.json`, "red"));
                }
            });
        } else {
            console.log(color(`Nomor ${i} aktif`, "green"));
            nomor_aktif.push(i);
            fs.writeFile('./nomor-aktif.json', JSON.stringify(nomor_aktif), (err) => {
                if (err) {
                    console.error('Terjadi kesalahan saat menyimpan data ke file JSON:', err);
                } else {
                    console.log(color(`Nomor ${i} berhasil disimpan ke file nomor-aktif.json`, "green"));
                }
            });
        }
        
        await sleep(500); // Jeda 
    }
    
    console.log(color(`Jumlah nomor aktif: ${nomor_aktif.length}`, "green"));
    console.log(color(`Jumlah nomor tidak aktif: ${nomor_tidak_aktif.length}`, "red"));
    process.exit();
    
} catch (err) {
    console.log(err);
}
 }
 
//  if (ev["call"]) {
//   const call = ev["call"]
//         let { id, chatId, isGroup } = call[0];
//         if (isGroup) return;
//         await sock.rejectCall(id, chatId);
//         // await sleep(3000);
//         // await sock.updateBlockStatus(chatId, "block"); // Block user
//         await sock.sendMessage(
// 			chatId,
// 			{
// 				text: "Maaf kak, telepon/video call tidak dapat diterima.",
// 			},
// 			{ ephemeralExpiration: upsert?.messages[0].contextInfo?.expiration }
// 		);
//     }
  });
}
connectToWhatsApp()