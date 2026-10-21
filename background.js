"use strict";

let lastUnread = 0;

function unreadFromTitle(title="") {
  const match = title.match(/\((\d+)\)/);
  return match ? Number(match[1]) : 0;
}

async function scanWhatsApp() {
  const tabs = await chrome.tabs.query({url: "https://web.whatsapp.com/*"});
  const unread = tabs.reduce((max, tab) => Math.max(max, unreadFromTitle(tab.title)), 0);
  lastUnread = unread;
  chrome.runtime.sendMessage({type: "WHATSAPP_STATUS", unread}).catch(() => {});
  return unread;
}

async function openWhatsApp() {
  const [tab] = await chrome.tabs.query({url: "https://web.whatsapp.com/*"});
  if (tab) {
    await chrome.tabs.update(tab.id, {active: true});
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, {focused: true});
  } else {
    await chrome.tabs.create({url: "https://web.whatsapp.com"});
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("scan-whatsapp", {periodInMinutes: 0.5});
  scanWhatsApp().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("scan-whatsapp", {periodInMinutes: 0.5});
  scanWhatsApp().catch(() => {});
});
chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === "scan-whatsapp") scanWhatsApp().catch(() => {})});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {if (tab.url?.startsWith("https://web.whatsapp.com/") && (changeInfo.title || changeInfo.status === "complete")) scanWhatsApp().catch(() => {})});
chrome.tabs.onRemoved.addListener(() => scanWhatsApp().catch(() => {}));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_WHATSAPP_STATUS") {scanWhatsApp().then(unread => sendResponse({unread})).catch(() => sendResponse({unread:lastUnread}));return true;}
  if (message?.type === "OPEN_WHATSAPP") {openWhatsApp().then(() => sendResponse({ok:true})).catch(() => sendResponse({ok:false}));return true;}
});
