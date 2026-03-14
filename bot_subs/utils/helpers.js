module.exports.getTimeLeft = (endDate) => {
    const now = new Date();
    const diff = new Date(endDate) - now;
    if (diff <= 0) return 'Subscription expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    return `${days} days, ${hours} hours, ${minutes} minutes`;
};

module.exports.getDaysLeft = (endDate) => {
    const now = new Date();
    const diff = new Date(endDate) - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};
