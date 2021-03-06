var register = (function() {
	var uuid = require('node-uuid'),
		q = require('q'),
		https = require('https'),
		fs = require('fs'),
		Serializ = require('./serializer'),
		serializer = new Serializ(),
		genRandom = require('./genRandom.js'),
		xpath = require('xpath'),
		domParser = new(require('xmldom').DOMParser)(),
		parser = require('xml2json'),
		traverse = require('traverse'),
		faultTextXpath = "//*[local-name()='Fault']/*[local-name()='Reason']/*[local-name()='Text']/text()";


	function executePost(options, action, template, body, cb, stop) {
		if (!options || typeof options !== 'object') {
			log("'options' argument is missing or invalid.");
		}

		if (options.KeyIdentifier && options.CiperValue0 && options.CiperValue1) {
			return executeSoapPost(options, action, template, body, cb);
		}
	}

	function Execute(options, cb) {
		var apiExecuteMessage = fs.readFileSync("xml/api_execute.xml").toString();

		return executePost(options, "Execute", apiExecuteMessage, serializer.toXmlExecute(options), cb);
	}

	function renameKey(objInd, prefixes) {
		var rk = objInd;

		prefixes.forEach(function(p) {
			if (objInd.indexOf(p) === 0) {
				rk = objInd.replace(p, '');
			}
		});
		return rk;
	}

	function executeSoapPost(options, action, template, body, cb, stop) {
		var timeCreated = new Date(),
			timeExpires = new Date(timeCreated.getTime() + 5 * 60000),
			soapHeader, req,
			xmlrequestbody,
			requestOptions,
			soapPostMessage,
			soapHeaderMessage = fs.readFileSync("xml/soapHeader.xml").toString(),
			soapEnvelopeMessage = fs.readFileSync("xml/soapMessage.xml").toString(),
			deferred = q.defer();

		soapHeader = soapHeaderMessage
			.replace("{action}", action)
			.replace("{messageid}", uuid.v4())
			// .replace("{crmurl}", "https://ineducrm.api.crm4.dynamics.com/XRMServices/2011/Organization.svc")
			.replace("{crmurl}", "https://inedua2.sharepoint.com/sites/inedu/dev/lightLMS_tasks/_vti_bin/lists.asmx")
			.replace("{created}", timeCreated.toISOString())
			.replace("{expires}", timeExpires.toISOString())
			.replace("{keyidentifier}", options.KeyIdentifier)
			.replace("{cipher0}", options.CiperValue0)
			.replace("{cipher1}", options.CiperValue1);

		xmlrequestbody = template.replace("{requetbody}", body);

		soapPostMessage = soapEnvelopeMessage
			.replace("{header}", soapHeader)
			.replace("{body}", xmlrequestbody);

		requestOptions = {
			method: 'POST',
			host: 'ineducrm.api.crm4.dynamics.com',
			path: '/XRMServices/2011/Organization.svc',
			secureProtocol: "SSLv3_method",
			headers: {
				'Content-Type': 'application/soap+xml; charset=UTF-8',
				'Content-Length': soapPostMessage.length
			}
		};

		requestOptions.agent = new https.Agent(requestOptions);

		if (stop) {
			deferred.resolve(soapPostMessage);
		}

		req = https.request(requestOptions, function(res) {
			var xml = '';
			res.setEncoding('utf8');

			res.on('data', function(chunk) {
				xml += chunk;
			});

			res.on('end', function() {
				var resXml = domParser.parseFromString(xml),
					fault = xpath.select(faultTextXpath, resXml),
					data, jsondata, data_no_ns, prefixes, pos, k, key;

				if (fault.length > 0) {
					log(fault);
					deferred.reject(fault);
				}

				data = xml;


				jsondata = JSON.parse(parser.toJson(xml));

				deferred.resolve(cb(jsondata));
			});
		});

		req.on('error', function(err) {
			deferred.reject(err);
			log(err);
		});

		req.end(soapPostMessage);
		return deferred.promise;
	}

	function normalizeData(data) {
		var leaves = [],
			results = [];

		traverse(data).forEach(function(x) {
			if (typeof this.key !== "undefined" && this.key.indexOf('KeyValuePairOfstringanyType') !== -1) {
				leaves.push(x);
			}
		});

		leaves.forEach(function(leave) {
			var obj = {};
			leave.forEach(function(l) {
				var key = l['c:key'],
					value = l['c:value'];

				obj[key] = value;
			});
			results.push(obj);

		});
		return results;
	}

	function normalizeAttribute(data) {
		var i, len,
			options = [],
			leaves = [],
			labels = [],
			values = [];

		traverse(data).forEach(function(x) {
			if (typeof this.key !== "undefined" && this.key.indexOf('Options') !== -1) {
				x["d:OptionMetadata"].forEach(function(v) {
					options.push(v['d:Label']);
					values.push(v['d:Value']);
				});
			}
		});

		options.forEach(function(option) {
			traverse(option).forEach(function(x) {
				if (typeof this.key !== "undefined" && this.key.indexOf('UserLocalizedLabel') !== -1) {
					labels.push(x);
				}
			});
		});

		labels.forEach(function(lab) {
			traverse(lab).forEach(function(l) {
				if (typeof this.key !== "undefined" && this.key.indexOf('Label') !== -1) {
					leaves.push({label: l});
				}
			});
		});

		for (i = 0, len = values.length; i < len; i++) {
			leaves[i].value = values[i];
		}

		return leaves;
	}

	function log(mes) {
		process.stdout.write(mes + '\n');
	}

	return {
		registerDevice: function() {
			var options, req,
				deferred = q.defer(),
				username = genRandom.generateRandom(24, 'aA#'),
				password = genRandom.generateRandom(24, 'aA#'),
				authCreateDeviceMessage = fs.readFileSync("xml/auth_create_device.xml").toString();

			authCreateDeviceMessage = authCreateDeviceMessage
				.replace("{newguid}", uuid.v4())
				.replace("{username}", username)
				.replace("{password}", password);

			options = {
				hostname: 'login.microsoftonline.com',
				port: 443,
				path: '/ppsecure/DeviceAddCredential.srf',
				method: 'POST',
				secureProtocol: "SSLv3_method",
				headers: {
					'Content-Type': 'application/soap+xml; charset=UTF-8',
					'Content-Length': authCreateDeviceMessage.length
				}
			};

			options.agent = new https.Agent(options);

			req = https.request(options, function(res) {
				var xml = '';
				res.setEncoding('utf8');

				res.on('data', function(chunk) {
					xml += chunk;
					log(chunk);
				});

				res.on('end', function(d) {
					var resXml = domParser.parseFromString(xml),
						fault = xpath.select(faultTextXpath, resXml),
						puid, device;

					if (fault.length > 0) {
						log(fault.toString());
					}

					puid = xpath.select("/DeviceAddResponse/puid/text()", resXml).toString();

					device = {
						deviceUsername: username,
						devicePassword: password,
						puid: puid
					};

					deferred.resolve(device);
				});
			});

			req.write(authCreateDeviceMessage);

			req.end();

			req.on('error', function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		},
		getToken: function(device) {
			var timeCreated = new Date(),
				deferred = q.defer(),
				requestOptions, req,
				timeExpires = new Date(timeCreated.getTime() + 5 * 60 * 1000),
				authRequestDeviceTokenMessage = fs.readFileSync("xml/auth_tokenrequest_device.xml").toString();

			authRequestDeviceTokenMessage = authRequestDeviceTokenMessage
				.replace("{messageuuid}", uuid.v4())
				.replace("{timeCreated}", timeCreated.toISOString())
				.replace("{timeExpires}", timeExpires.toISOString())
				.replace("{deviceUsername}", device.deviceUsername)
				.replace("{devicePassword}", device.devicePassword);

			requestOptions = {
				method: 'POST',
				host: 'login.microsoftonline.com',
				path: '/RST2.srf',
				headers: {
					'Content-Type': 'application/soap+xml; charset=UTF-8',
					'Content-Length': authRequestDeviceTokenMessage.length
				}
			};

			req = https.request(requestOptions, function(res) {
				var xml = '',
					resXml, fault,
					cipherValue, cipher;

				res.setEncoding('utf8');

				res.on('data', function(chunk) {
					xml += chunk;
					log(chunk);
				});

				res.on('end', function() {
					resXml = domParser.parseFromString(xml);
					fault = xpath.select(faultTextXpath, resXml);

					if (fault.length > 0) {
						log(fault.toString());
					}

					cipherValue = xpath.select("//*[local-name()='RequestedSecurityToken' and namespace-uri()='http://schemas.xmlsoap.org/ws/2005/02/trust']/*[name()='EncryptedData']/*[name()='CipherData']/*[name()='CipherValue']/text()", resXml).toString();

					cipher = {
						CipherValue: cipherValue
					};

					deferred.resolve(cipherValue);
				});
			});

			req.end(authRequestDeviceTokenMessage);

			req.on('error', function(e) {
				deferred.reject(e);
			});

			return deferred.promise;
		},
		getTokenLiveId: function(cipherValue, user) {
			var timeCreated = new Date(),
				deferred = q.defer(),
				requestOptions, req,
				timeExpires = new Date(timeCreated.getTime() + 5 * 60 * 1000),
				authRequestSTSTokenMessage = fs.readFileSync("xml/auth_tokenrequest_liveid.xml").toString();

			log("cipherValue   :" + cipherValue);
			authRequestSTSTokenMessage = authRequestSTSTokenMessage
				.replace("{messageuuid}", uuid.v4())
				.replace("{created}", timeCreated.toISOString())
				.replace("{expires}", timeExpires.toISOString())
				.replace("{cipher}", cipherValue)
				.replace("{username}", user.username)
				.replace("{password}", user.password);

			requestOptions = {
				method: 'POST',
				host: 'login.microsoftonline.com',
				path: '/RST2.srf',
				headers: {
					'Content-Type': 'application/soap+xml; charset=UTF-8',
					'Content-Length': authRequestSTSTokenMessage.length
				}
			};

			req = https.request(requestOptions, function(res) {
				var xml = '';

				res.setEncoding('utf8');

				res.on('data', function(chunk) {
					xml += chunk;
				});

				res.on('end', function() {
					var resXml = domParser.parseFromString(xml),
						fault = xpath.select(faultTextXpath, resXml),
						fullMessage, faultDetailsXpath, faultDetails,
						keyIdentifier,
						cipherValue0, cipherValue1,
						userTokens;

					if (fault.length > 0) {
						fullMessage = fault.toString();

						faultDetailsXpath = "//*[local-name()='Fault']/*[local-name()='Detail']";
						faultDetails = xpath.select(faultDetailsXpath, resXml);

						if (faultDetails.length > 0) {
							//fullMessage = fullMessage + ". Details:" + parser.toJson(faultDetails.toString());
							log(fullMessage);
						}
					}

					keyIdentifier = xpath.select("//*[local-name()='RequestedSecurityToken' and namespace-uri()='http://schemas.xmlsoap.org/ws/2005/02/trust']/*[name()='EncryptedData']/*[local-name()='KeyInfo' and namespace-uri()='http://www.w3.org/2000/09/xmldsig#']/*[name()='EncryptedKey']/*[local-name()='KeyInfo']/*[local-name()='SecurityTokenReference']/*[local-name()='KeyIdentifier']/text()", resXml).toString();
					cipherValue0 = xpath.select("//*[local-name()='RequestedSecurityToken' and namespace-uri()='http://schemas.xmlsoap.org/ws/2005/02/trust']/*[name()='EncryptedData']/*[local-name()='KeyInfo' and namespace-uri()='http://www.w3.org/2000/09/xmldsig#']/*[name()='EncryptedKey']/*[local-name()='CipherData']/*[local-name()='CipherValue']/text()", resXml).toString();
					cipherValue1 = xpath.select("//*[local-name()='RequestedSecurityToken' and namespace-uri()='http://schemas.xmlsoap.org/ws/2005/02/trust']/*[name()='EncryptedData']/*[name()='CipherData']/*[name()='CipherValue']/text()", resXml).toString();

					log("keyIdentifier" + keyIdentifier);
					log("cipherValue0" + cipherValue0);
					log("cipherValue1" + cipherValue1);


					userTokens = {
						KeyIdentifier: keyIdentifier,
						CiperValue0: cipherValue0,
						CiperValue1: cipherValue1
					};

					deferred.resolve(userTokens);

				});
			});

			req.on('error', function(err) {
				deferred.reject(err);
			});

			req.end(authRequestSTSTokenMessage);

			return deferred.promise;
		},
		retrieveMultiple: function(options) {
			var apiRetrieveMultipleMessage = fs.readFileSync("xml/api_retrievemultiple.xml").toString();

			return executePost(options, "RetrieveMultiple", apiRetrieveMultipleMessage, serializer.toXmlRetrieveMultiple(options), normalizeData);
		},
		retrieveAllEntities: function(options) {
			var apiRetrieveAllEntittiesMessage = fs.readFileSync("xml/api_RetrieveAllEntities.xml").toString();

			return executePost(options, "Execute", apiRetrieveAllEntittiesMessage, serializer.toXmlRetrieveAllEntities(options));
		},
		retrieveAttribute: function(options) {
			var apiRetrieveAttributeMessage = fs.readFileSync("xml/api_retrieveAttribute.xml").toString();

			apiRetrieveAttributeMessage = apiRetrieveAttributeMessage
				.replace('{entity}', options.EntityName)
				.replace('{attribute}', options.AttributeName);


			return executePost(options, "Execute", apiRetrieveAttributeMessage, serializer.toXmlRetrieveAttribute(options), normalizeAttribute, false);
		}
	};
}());

module.exports = register;