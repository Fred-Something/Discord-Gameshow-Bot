function check(message, num) {
    return {pass: true, output: 'Response **' + (num + 1) + '** recorded:\n`' + message + "`\nIf you want to edit your response, simply send another message. Remember to **only include your response in the message, nothing else**"};
}

module.exports = {check};