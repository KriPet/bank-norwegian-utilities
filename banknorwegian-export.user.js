"use strict";
// ==UserScript==
// @name         Bank Norwegian transaction export
// @namespace    http://bakemo.no/
// @version      0.0.1
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://www.banknorwegian.no/minside/*
// @downloadURL  https://github.com/KriPet/bank-norwegian-utilities/raw/main/banknorwegian-export.user.js
// ==/UserScript==
class NorwegianUtilities {
    static host = "https://www.banknorwegian.no/api/v1/";
    static accountsUrl = new URL("/api/v1/transaction?accountGroupId=5", this.host);
    static transactionsUrl = (accountId) => new URL(`/api/v1/transaction/GetTransactionsFromTo?accountNo=${accountId}`, this.host);
    static async fetch(url) {
        const response = fetch(url, {
            "credentials": "include",
            "method": "GET"
        });
        return response;
    }
    static async getAccountIds() {
        console.debug("Getting accounts");
        const response = await this.fetch(this.accountsUrl);
        console.debug("Got accounts");
        const responseJson = await response.json();
        console.debug(responseJson);
        return responseJson.accountList.map(a => a.value);
    }
    static async getTransactions(accountId) {
        console.debug(`Getting transactions for account ${accountId}`);
        const url = this.transactionsUrl(accountId);
        const response = await this.fetch(url);
        const responseJson = await response.json();
        console.debug(responseJson);
        return responseJson;
    }
    static async downloadTransactions(accountId) {
        const transactions = await this.getTransactions(accountId);
        if (transactions.length == 0) {
            console.info("No transactions found");
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
    static transactionsToXml(transactions) {
        const { doc, transactionListElement } = this.createXmlDocumentRoot();
        for (const transaction of transactions) {
            const transactionDate = transaction.transactionDate.replace(/-/g, '').split("T")[0];
            const transactionElement = doc.createElement("STMTTRN");
            const dateElem = transactionElement.appendChild(doc.createElement("DTPOSTED"));
            const amountElem = transactionElement.appendChild(doc.createElement("TRNAMT"));
            const nameElem = transactionElement.appendChild(doc.createElement("NAME"));
            const memoElem = transactionElement.appendChild(doc.createElement("MEMO"));
            nameElem.append(transaction.merchantName);
            memoElem.append(transaction.message);
            dateElem.append(transactionDate);
            amountElem.append(transaction.amount.toFixed(2));
            transactionListElement.appendChild(transactionElement);
        }
        return doc;
    }
    static createXmlDocumentRoot() {
        const doc = document.implementation.createDocument(null, "OFX", null);
        const OFX = doc.documentElement;
        const BANKMSGSRSV1 = OFX.appendChild(doc.createElement("BANKMSGSRSV1"));
        const STMTTRNRS = BANKMSGSRSV1.appendChild(doc.createElement("STMTTRNRS"));
        const STMTRS = STMTTRNRS.appendChild(doc.createElement("STMTRS"));
        const transactionListElement = STMTRS.appendChild(doc.createElement("BANKTRANLIST"));
        return { doc, transactionListElement };
    }
    static async downloadAllAccountTransactions() {
        const accountIds = await this.getAccountIds();
        for (const accountId of accountIds) {
            this.downloadTransactions(accountId);
        }
    }
    static initialize() {
        console.log("Initializing Bank Norwegian utilities");
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case "-": {
                    if (event.ctrlKey)
                        break;
                    this.downloadAllAccountTransactions();
                    break;
                }
            }
        });
    }
}
NorwegianUtilities.initialize();
