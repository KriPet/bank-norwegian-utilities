// ==UserScript==
// @name         Bank Norwegian transaction export
// @namespace    http://bakemo.no/
// @version      0.0.1
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://www.banknorwegian.no/minside/*
// @downloadURL  https://github.com/KriPet/bank-norwegian-utilities/raw/main/banknorwegian-export.user.js
// ==/UserScript==


type AccountResponse = {
    accountNo: string
    accountList: {
        disabled: boolean,
        text: string,
        value: string
    }[]
}

type Transaction = {
    externalId: number
    transactionDate: string // yyyy-mm-ddT00:00:00
    message: string
    merchantName: string
    amount: number
}

class NorwegianUtilities {

    private static host = "https://www.banknorwegian.no/api/v1/";
    private static accountsUrl = new URL("/api/v1/transaction?accountGroupId=5", this.host);
    private static transactionsUrl = (accountId: string) => new URL(`/api/v1/transaction/GetTransactionsFromTo?accountNo=${accountId}`, this.host);

    private static async fetch(url: URL) {
        const response = fetch(url, {
            "credentials": "include",
            "method": "GET"
        });
        return response;
    }

    private static async getAccountIds(): Promise<string[]> {
        console.debug("Getting accounts");
        const response = await this.fetch(this.accountsUrl);
        console.debug("Got accounts");
        const responseJson: AccountResponse = await response.json();
        console.debug(responseJson);
        return responseJson.accountList.map(a => a.value)
    }

    private static async getTransactions(accountId: string): Promise<Transaction[]> {
        console.debug(`Getting transactions for account ${accountId}`)
        const url = this.transactionsUrl(accountId);
        const response = await this.fetch(url);
        const responseJson: Transaction[] = await response.json();
        console.debug(responseJson)
        return responseJson
    }

    private static async downloadTransactions(accountId: string) {
        const transactions = await this.getTransactions(accountId);
        if (transactions.length == 0) {
            console.info("No transactions found")
            return;
        }

        const xmlDoc = this.transactionsToXml(transactions);

        const xmlText = new XMLSerializer().serializeToString(xmlDoc);

        const blob = new Blob([xmlText], { type: "application/x-ofx" });

        const link = document.createElement("a");
        const dateString = new Date().toISOString().substring(0, 10);
        link.download = `${dateString} BankNorwegian ${accountId}.ofx`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    private static transactionsToXml(transactions: Transaction[]) {
        const { doc, transactionListElement } = this.createXmlDocumentRoot();

        for (const transaction of transactions) {
            const transactionDate = transaction.transactionDate.replace(/-/g, '').split("T")[0]!;

            const transactionElement = doc.createElement("STMTTRN");
            const dateElem = transactionElement.appendChild(doc.createElement("DTPOSTED"));
            const amountElem = transactionElement.appendChild(doc.createElement("TRNAMT"));
            const nameElem = transactionElement.appendChild(doc.createElement("NAME"));
            const memoElem = transactionElement.appendChild(doc.createElement("MEMO"));
            nameElem.append(transaction.merchantName);
            memoElem.append(transaction.message)
            dateElem.append(transactionDate);
            amountElem.append(transaction.amount.toFixed(2));
            transactionListElement.appendChild(transactionElement);
        }

        return doc
    }

    private static createXmlDocumentRoot() {
        const doc = document.implementation.createDocument(null, "OFX", null);
        const OFX = doc.documentElement;
        const BANKMSGSRSV1 = OFX.appendChild(doc.createElement("BANKMSGSRSV1"));
        const STMTTRNRS = BANKMSGSRSV1.appendChild(doc.createElement("STMTTRNRS"));
        const STMTRS = STMTTRNRS.appendChild(doc.createElement("STMTRS"));
        const transactionListElement = STMTRS.appendChild(doc.createElement("BANKTRANLIST"));
        return { doc, transactionListElement }
    }

    private static async downloadAllAccountTransactions() {
        const accountIds = await this.getAccountIds();
        for (const accountId of accountIds) {
            this.downloadTransactions(accountId);
        }
    }

    public static initialize() {
        console.log("Initializing Bank Norwegian utilities");
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case "-": {
                    if (event.ctrlKey)
                        break
                    this.downloadAllAccountTransactions();
                    break;
                }
            }
        });
    }
}


NorwegianUtilities.initialize();