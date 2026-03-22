const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'store.json');

const readData = () => {
    try {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
            donations: Array.isArray(parsed.donations) ? parsed.donations : [],
            users: Array.isArray(parsed.users) ? parsed.users : [],
            login_events: Array.isArray(parsed.login_events) ? parsed.login_events : []
        };
    } catch (err) {
        return { subscriptions: [], donations: [], users: [], login_events: [] };
    }
};

const writeData = (data) => {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const listSubscriptions = () => readData().subscriptions;
const listDonations = () => readData().donations;
const listUsers = () => readData().users;
const listLoginEvents = () => readData().login_events;

const addSubscription = (sub) => {
    const data = readData();
    const record = { _id: generateId(), ...sub };
    data.subscriptions.push(record);
    writeData(data);
    return record;
};

const addDonation = (donation) => {
    const data = readData();
    const record = { _id: generateId(), ...donation };
    data.donations.push(record);
    writeData(data);
    return record;
};

const addUser = (user) => {
    const data = readData();
    const record = { _id: generateId(), ...user };
    data.users.push(record);
    writeData(data);
    return record;
};

const addLoginEvent = (event) => {
    const data = readData();
    const record = { _id: generateId(), ...event };
    data.login_events.push(record);
    writeData(data);
    return record;
};

const updateSubscriptionById = (id, updates) => {
    const data = readData();
    const idx = data.subscriptions.findIndex(s => s._id === id);
    if (idx === -1) return null;
    data.subscriptions[idx] = { ...data.subscriptions[idx], ...updates };
    writeData(data);
    return data.subscriptions[idx];
};

const updateDonationById = (id, updates) => {
    const data = readData();
    const idx = data.donations.findIndex(d => d._id === id);
    if (idx === -1) return null;
    data.donations[idx] = { ...data.donations[idx], ...updates };
    writeData(data);
    return data.donations[idx];
};

const deleteSubscriptionById = (id) => {
    const data = readData();
    const next = data.subscriptions.filter(s => s._id !== id);
    if (next.length === data.subscriptions.length) return false;
    data.subscriptions = next;
    writeData(data);
    return true;
};

const findSubscriptionById = (id) => listSubscriptions().find(s => s._id === id);
const findDonationById = (id) => listDonations().find(d => d._id === id);
const findUserByEmail = (email) => listUsers().find(u => u.email === email);
const findSubscriptionByPaypalOrderId = (orderId) => listSubscriptions().find(s => s.paypal_order_id === orderId);

const upsertSubscriptionByServerId = (serverId, updates) => {
    const data = readData();
    const idx = data.subscriptions.findIndex(s => s.server_id === serverId);
    if (idx === -1) {
        const record = { _id: generateId(), ...updates };
        data.subscriptions.push(record);
        writeData(data);
        return record;
    }
    data.subscriptions[idx] = { ...data.subscriptions[idx], ...updates };
    writeData(data);
    return data.subscriptions[idx];
};

module.exports = {
    listSubscriptions,
    listDonations,
    listUsers,
    listLoginEvents,
    addSubscription,
    addDonation,
    addUser,
    addLoginEvent,
    updateSubscriptionById,
    updateDonationById,
    deleteSubscriptionById,
    findSubscriptionById,
    findDonationById,
    findSubscriptionByPaypalOrderId,
    findUserByEmail,
    upsertSubscriptionByServerId
};
