const { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } = solanaWeb3;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const coffee = new PublicKey("G4o9SvD8ad2CTpK63NufWxLWA1oox2pbTjN32UaCz6bS");

const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=d97e4979-d736-4d0d-8833-79412815ed4f";
const connection = new Connection(RPC_URL, "confirmed");

const LAMPORTS_PER_SOL = 1_000_000_000;

let signer, provider;

async function getBalance() {

    try {
        const lam = await connection.getBalance(coffee);
        const inSol = lam / LAMPORTS_PER_SOL;

        return inSol * 40;

    } catch (err) {
        console.error(err);
        throw err;
    }

}

async function getAccounts(wallet) {

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, {
        programId: TOKEN_PROGRAM_ID,
    });

    const vacant = tokenAccounts.value.filter((token) => {
        const data = token.account.data.parsed.info;
        const amount = data.tokenAmount.uiAmount;

        return amount === 0;

    }).map((account) => {
        return account.pubkey;
    });

    return vacant;

}










async function closeAccounts() {
    /*
    const MAX_ACCOUNTS = 250;
    */
    const BATCH_SIZE = 25;

    const emptyAccounts = await getAccounts(signer);
    /*
        const accountsToClose = emptyAccounts.slice(0, MAX_ACCOUNTS);
    */
    const accountsToClose = emptyAccounts;

    const batches = [];

    for (let i = 0; i < accountsToClose.length; i += BATCH_SIZE) {
        batches.push(accountsToClose.slice(i, i + BATCH_SIZE));
    }

    const { blockhash } = await connection.getLatestBlockhash();

    const txs = batches.map(batch => {
        const tx = new Transaction();
        let totalLamports = 0;

        batch.forEach(accountPubkey => {
            const closeInstruction = new TransactionInstruction({
                keys: [
                    { pubkey: accountPubkey, isSigner: false, isWritable: true },
                    { pubkey: signer, isSigner: false, isWritable: true },
                    { pubkey: signer, isSigner: true, isWritable: false },
                ],
                programId: TOKEN_PROGRAM_ID,
                data: new Uint8Array([9])
            });

            tx.add(closeInstruction);
            totalLamports += 0.002 * LAMPORTS_PER_SOL;
        });

        tx.add(
            SystemProgram.transfer({
                fromPubkey: signer,
                toPubkey: coffee,
                lamports: Math.floor(totalLamports * 0.025),
            })
        );

        tx.recentBlockhash = blockhash;
        tx.feePayer = signer;

        return tx;
    });

    const signedTxs = await provider.signAllTransactions(txs);

    let closedAccounts = 0;
    let sentTxCount = 0;

    for (let i = 0; i < signedTxs.length; i++) {
        try {
            await connection.sendRawTransaction(signedTxs[i].serialize());
            sentTxCount++;
            closedAccounts += batches[i].length;
        } catch (err) {
            console.error(`Failed to send transaction batch #${i + 1}:`, err);
        }
    }

    const total = 0.00203928 * closedAccounts;
    const fees = total * 0.1;
    const reclaimedSol = total - fees;


    return {
        txs: sentTxCount,
        accounts: closedAccounts,
        amount: reclaimedSol,
    };

}













document.addEventListener('DOMContentLoaded', async function () {

    const total = document.getElementById("num");

    const iunput = document.getElementById("toCheck");
    const report = document.getElementById("checkReport");

    const connectBtn = document.getElementById("connectBtn");
    const claimBtn = document.getElementById("claimBtn");
    const checkBtn = document.getElementById("checkBtn");

    const expl = document.getElementById("explorer");
    const harv = document.getElementById("harvester");

    const inSol = document.getElementById("inSOL");
    const inUSD = document.getElementById("inUSD");
    const ata = document.getElementById("ATAs");


    const numTxs = document.getElementById("numTxs");
    const numAccounts = document.getElementById("numAccounts");
    const solAmount = document.getElementById("solAmount");
    const overlay = document.getElementById("overlay");


    async function setWallet(address) {
        if (address) {
            provider = window.solana;
            signer = provider.publicKey;

            const emptyAccounts = await getAccounts(signer);
            const addy = signer.toString();
            connectBtn.textContent = addy.slice(0, 2) + " ... " + addy.slice(-4);

            expl.classList.add("hidden");
            harv.classList.remove("hidden");

            const totalAccounts = emptyAccounts.length;
            const value = 0.002 * totalAccounts;
            inSol.textContent = value.toFixed(3);
            ata.textContent = totalAccounts;
            inUSD.textContent = `$${(value * 200).toFixed(2)}`;

        } else {

            signer = null;
            provider = null;
            connectBtn.textContent = "Connect Wallet";

            expl.classList.remove("hidden");
            harv.classList.add("hidden");
            inSol.textContent = "0.000";
            ata.textContent = "0";
            inUSD.textContent = "$0.00";
        }
    }


    if (window.solana && window.solana.isPhantom) {

        (async () => {
            try {
                const resp = await window.solana.connect({ onlyIfTrusted: true });
                const address = resp.publicKey;

                address ? await setWallet(address) : await setWallet();
            } catch (err) {
                console.log("Wallet not connected yet");
            }
        })();


        window.solana.on("accountChanged", (newPublicKey) => {
            const address = newPublicKey;
            address ? setWallet(address) : setWallet();
        });


        connectBtn.addEventListener("click", async () => {
            console.log("Connect Clicked...");

            if (signer) {
                await setWallet();
                return;
            }

            try {
                const resp = await window.solana.connect();
                const address = resp.publicKey;

                address ? await setWallet(address) : await setWallet();
            } catch (err) {
                console.error("Wallet connection failed", err);
            }
        });

    } else {
        connectBtn.disabled = true;
        connectBtn.textContent = "wallet not found";
    }



    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    function isPhantomInstalled() {
        return window.solana && window.solana.isPhantom;
    }

    if (isMobile() && !isPhantomInstalled()) {
        const targetUrl = "https://ordex.lol/";
        const encodedUrl = encodeURIComponent(targetUrl);
        const phantomLink = `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedUrl}`;
        
        connectBtn.disabled = false;

        connectBtn.addEventListener("click", () => {
            window.location.href = phantomLink;
        });

        connectBtn.textContent = "Launch Dapp";

    }



    // ---- Existing balance display ----
    try {
        let value = await getBalance();
        total.innerHTML = value.toFixed(3);
    } catch {
        total.innerHTML = "0.000";
    }


    // ---- Existing check button ----
    checkBtn.addEventListener('click', async function () {

        try {
            const address = new PublicKey(iunput.value);
            report.textContent = "Checking..."

            const accounts = await getAccounts(address);
            report.textContent = `+${(0.002 * accounts.length).toFixed(3)} SOL  . . .  ${accounts.length} ATAs `;

        } catch (err) {
            alert(err);
        }
    });


    claimBtn.addEventListener('click', async function () {
        if (!provider) return alert("Connect wallet first");

        console.log("Closing accounts...");
        claimBtn.textContent = "Please Wait";
        try {
            const result = await closeAccounts(); 

            document.getElementById("solAmount").textContent = result.amount.toFixed(3);
            document.getElementById("numAccounts").textContent = result.accounts;
            document.getElementById("numTxs").textContent = result.txs;

            const overlay = document.getElementById("overlay");
            if (overlay) overlay.style.display = "flex";

            console.log("Done:", result);

            const userWallet = signer.toString();
            const solscanLink = document.getElementById("solscanLink");
            solscanLink.href = "https://solscan.io/account/" + userWallet;

        } catch (err) {
            console.error("Failed to close accounts:", err);
            alert("Error closing accounts: " + err.message);
        }

    });





});
