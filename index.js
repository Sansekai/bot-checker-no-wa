import {
	makeWASocket,
	fetchLatestBaileysVersion,
	DisconnectReason,
	useMultiFileAuthState,
	makeCacheableSignalKeyStore,
  Browsers,
  makeInMemoryStore
} from "@whiskeysockets/baileys";
import Pino from "pino";
import fs from "fs";
import chalk from "chalk";
import { Boom } from "@hapi/boom";

const store = makeInMemoryStore({ logger: Pino().child({ level: "silent", stream: "store" }) });

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectToWhatsApp(use_pairing_code = false) {
	const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");

	const { version } = await fetchLatestBaileysVersion();
	const sock = makeWASocket({
		version,
		printQRInTerminal: !use_pairing_code,
		mobile: false,
		auth: state,
		generateHighQualityLinkPreview: true,
		// msgRetryCounterCache: retryCache,
		Browsers: Browsers.macOS("Chrome"),
		// getMessage,
	});

	store?.bind(sock.ev);

	if (
		use_pairing_code &&
		Config.phone_number &&
		!sock.authState.creds.registered
	) {
		const phone_number = Config.phone_number.replace(/[^0-9]/g, "");
		Print.debug("Using Pairing Code To Connect: ", phone_number);
		await new Promise((resolve) => setTimeout(resolve, Config.pairing_wait));
		const code = await sock.requestPairingCode(phone_number);
		Print.success("Pairing Code:", code);
	}

		sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        if (reason === DisconnectReason.badSession) {
          console.log(`Bad Session File, Please Delete Session and Scan Again`);
          process.exit();
        } else if (reason === DisconnectReason.connectionClosed) {
          console.log("Connection closed, reconnecting....");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionLost) {
          console.log("Connection Lost from Server, reconnecting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionReplaced) {
          console.log("Connection Replaced, Another New Session Opened, Please Restart Bot");
          process.exit();
        } else if (reason === DisconnectReason.loggedOut) {
          console.log(`Device Logged Out, Please Delete Folder Session yusril and Scan Again.`);
          process.exit();
        } else if (reason === DisconnectReason.restartRequired) {
          console.log("Restart Required, Restarting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.timedOut) {
          console.log("Connection TimedOut, Reconnecting...");
          connectToWhatsApp();
        } else {
          console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
          connectToWhatsApp();
        }
      } else if (connection === "open") {
        console.log(color("Bot success conneted to server", "green"));
        console.log(color("Donate for creator https://saweria.co/sansekai", "yellow"));
        // sock.sendMessage(owner + "@s.whatsapp.net", { text: `Bot started!\n\njangan lupa support ya bang :)\n${donet}` });
      }
      // console.log('Connected...', update)
    });
    sock.ev.on("creds.update", saveCreds);
    // sock.ev.on("messages.upsert", async (message) => { 
    //   console.log(message);
    // })
		
    // GASSSSS
    sock.ev.on("messages.upsert", async (message) => {
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
        
        // await sleep(2000); // Jeda 2 detik di sini
    }
    
    console.log(color(`Jumlah nomor aktif: ${nomor_aktif.length}`, "green"));
    console.log(color(`Jumlah nomor tidak aktif: ${nomor_tidak_aktif.length}`, "red"));
    
} catch (err) {
    console.log(err);
}
});
    // GASSSSS
//  }

    
    //   const message = Messages(upsert, sock);
    //   console.log(message);
		// }
	return sock;
}
connectToWhatsApp()