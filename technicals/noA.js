function check(message) {
    const out = !(message.includes('a') || message.includes('A'));
    if (out) return 'pass';
    return 'Your response must not contain the letter A';
}

module.exports = {check};