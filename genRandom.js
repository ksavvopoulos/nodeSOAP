var genRandom = (function () {
	return {
		generateRandom: function (length, chars) {
			var mask = '',
				result = '',
				i;

			if (chars.indexOf('a') > -1) {
				mask += 'abcdefghijklmnopqrstuvwxyz';
			}
			if (chars.indexOf('A') > -1) {
				mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
			}
			if (chars.indexOf('#') > -1) {
				mask += '0123456789';
			}
			if (chars.indexOf('!') > -1) {
				mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
			}

			for (i = length; i > 0; --i) {
				result += mask[Math.round(Math.random() * (mask.length - 1))];
			}
			return result;
		}
	};

}());


module.exports = genRandom;