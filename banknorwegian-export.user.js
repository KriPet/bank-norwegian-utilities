"use strict";
// ==UserScript==
// @name         Bank Norwegian transaction export
// @namespace    http://bakemo.no/
// @version      0.0.3
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://www.banknorwegian.no/minside/*
// @downloadURL  https://github.com/KriPet/bank-norwegian-utilities/raw/main/banknorwegian-export.user.js
// ==/UserScript==
class NorwegianUtilities {
    static host = "https://www.banknorwegian.no/api/v1/";
    static accountsUrl = new URL("/api/v1/transaction?accountGroupId=5", this.host);
    static transactionsUrlOlder = (accountId) => {
        const d = new Date();
        const dateTo = d.toISOString().slice(0, 10);
        d.setDate(d.getDate() - 30);
        const dateFrom = d.toISOString().slice(0, 10);
        return new URL(`/api/v1/transaction/GetTransactionsFromTo?accountNo=${accountId}&getLastDays=false&fromLastEOC=false&dateFrom=${dateFrom}&dateTo=${dateTo}&coreDown=false`, this.host);
    };
    static transactionsUrlNewer = (accountId) => new URL(`/api/v1/transaction/GetTransactionsFromTo?accountNo=${accountId}&getLastDays=true&fromLastEOC=false&dateFrom=&dateTo=&coreDown=false`, this.host);
    static myCreditCardUrl = new URL(`/minside/creditcard`, this.host);
    static async fetch(url) {
        const response = fetch(url, {
            "credentials": "include",
            "method": "GET",
            "headers": {
                "accept": "application/json"
            }
        });
        return response;
    }
    static async getBalance() {
        const response = await this.fetch(this.myCreditCardUrl);
        const json = await response.json();
        console.debug(json);
        const balance = json.balance;
        return balance;
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
        let transactions = [];
        // Get older transactions
        {
            const url = this.transactionsUrlOlder(accountId);
            const response = await this.fetch(url);
            const responseJson = await response.json();
            console.debug(responseJson);
            transactions = responseJson;
        }
        // Get newer transactions
        {
            const url = this.transactionsUrlNewer(accountId);
            const response = await this.fetch(url);
            const responseJson = await response.json();
            console.debug(responseJson);
            transactions = [...transactions, ...responseJson];
        }
        return transactions;
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
            await this.downloadTransactions(accountId);
        }
        const balance = await this.getBalance();
        alert(`Your balance is ${balance}`);
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
