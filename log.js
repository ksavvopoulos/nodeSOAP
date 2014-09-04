var logFunction = (function () {
	return {
		log: function (mes) {
			process.stdout.write(mes + '\n');
		}
	};
}());


module.exports = logFunction.log;