var app = angular.module('myApp', ['ngRoute', 'ngResource']),
    spyreqs = spyreqs || {},
    say = spyreqs.utils?spyreqs.utils.say:function(){};

app.config(function($routeProvider) {
    "use strict";

    $routeProvider.
    when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
    }).
    when('/lessons', {
        templateUrl: 'views/lessons.html',
        controller: "lessonsCtrl"
    }).
    when('/addItem', {
        templateUrl: 'views/addItem.html'
    }).
    when('/ispring', {
        templateUrl: 'views/ispring.html'
    });

});


app.controller('MainCtrl', function($scope, $q, $resource) {
    "use strict";
    var Soap, User, retrAtrr,
        optionSets = [],
        cstypes = {
            "string": 2,
            "guid": 2,
            "boolean": 8,
            "Money": 10,
            "int": 1,
            "OptionSetValue": 6,
            "dateTime": 4,
            "EntityReference": 2,
            "decimal": 9
        }, itemType,
        unwanted = ["transactioncurrencyid", "owninguser", "owningbusinessunit", "inedu_studentacademicyearperiodid"];

    $scope.displayTypes = {
        "string": "$t",
        "guid": "$t",
        "boolean": "$t",
        "int": "$t",
        "Money": "b:Value",
        "OptionSetValue": "b:Value",
        "dateTime": "$t",
        "EntityReference": "b:Name",
        "decimal": "$t"
    };

    $scope.ispring = function() {
        var newIspring = window.open('http://ksavvas.azurewebsites.net/ispring');
        newIspring.onbeforeunload = function() {
            console.log('tesera');
        };
    };

    $scope.attributesArray = [];

    Soap = $resource('/soap/entity/:entity/attribute/:attribute', {
        entity: '@entity',
        attribute: '@attribute'
    }, {
        'get': {
            method: 'GET',
            isArray: true
        }
    });

    retrAtrr = $resource('/soap/retrieveAttribute/entity/:entity/attribute/:attribute', {}, {
        'get': {
            method: 'GET',
            isArray: true
        }
    });

    User = $resource('/login/', {}, {
        'save': {
            method: "POST",
            isArray: false
        }
    });

    function extraxtTypes(obj) {
        var key, type;

        $scope.attributesArray = [];

        for (key in obj) {
            if (obj[key]['i:type']) {
                type = obj[key]['i:type'].split(':')[1];

                $scope.attributesArray.push({
                    type: type,
                    key: key
                });
            }
        }
    }

    $scope.isLogged = false;
    $scope.invoices = [];
    $scope.hello = "Hello World!";

    // $q.when(spyreqs.rest.getHostLists('')).then(function(data) {

    //     say(data);

    //     $scope.items = data.d.results;
    // });

    $scope.login = function() {
        var post = User.save({}, {
            username: $scope.username,
            password: $scope.password
        }, function() {
            $scope.isLogged = post.logged;
        });
    };

    $scope.soap = function() {
        var res = Soap.get({
            entity: $scope.entity,
            attribute: $scope.attribute ? $scope.attribute : ""
        }, function() {
            extraxtTypes(res[0]);

            $scope.showSoap = true;
            say(res);
            $scope.invoices = res;
        });
    };

    function getAtrribute(attrName, cb) {
        var res = retrAtrr.get({
            entity: $scope.entity,
            attribute: attrName
        }, function() {
            say(res);
            cb(res);
        });
    }

    function createFields(listGuid, attributes) {
        var field, attr, items, fieldType, attrName;

        function addField() {
            $q.when(spyreqs.rest.addHostListField(listGuid, field, fieldType))
                .then(function(data) {
                    say(data);
                    createFields(listGuid, attributes);
                });
        }

        if (attributes.length > 0) {
            attr = attributes.shift();
            attrName = attr.key;

            if (unwanted.indexOf(attrName) !== -1) {
                return createFields(listGuid, attributes);
            }

            field = {
                Title: attrName,
                FieldTypeKind: cstypes[attr.type],
                Required: false,
                EnforceUniqueValues: false,
                StaticName: attrName,
                Hidden: false
            };

            if (attr.type === "Money") {
                field.CurrencyLocaleId = 1032;
                fieldType = "SP.FieldCurrency";
                addField();
            } else if (attr.type === "OptionSetValue") {
                fieldType = "SP.FieldChoice";

                getAtrribute(attrName, function(data) {
                    var i, len, results = [];

                    optionSets.push({
                        name: attrName,
                        data: data
                    });

                    for (i = 0, len = data.length; i < len; i++) {
                        results.push(data[i].label);
                    }

                    field.Choices = {
                        results: results
                    };
                    addField();
                });

            } else {
                addField();
            }


        } else {
            say('All fields created');

            items = angular.copy($scope.invoices);
            addItems(items);
        }
    }

    function addItems(items) {
        var item,
            itemToCreate,
            i, len, attr, attrType;

        if (items.length > 0) {
            item = items.shift();

            itemToCreate = {
                "__metadata": {
                    type: itemType
                },
                Title: item[$scope.selectedAttr.key][$scope.displayTypes[$scope.selectedAttr.type]]
            };

            for (i = 0, len = $scope.attributesArray.length; i < len; i++) {
                attr = $scope.attributesArray[i].key;
                attrType = $scope.attributesArray[i].type;

                if (item[attr] && unwanted.indexOf(attr) === -1) {
                    if (attrType === "OptionSetValue") {
                        //itemToCreate[attr] = item[attr][$scope.displayTypes[attrType]].toString();
                        itemToCreate[attr] = valueToLabel(attr, item[attr][$scope.displayTypes[attrType]]);
                    } else {
                        itemToCreate[attr] = item[attr][$scope.displayTypes[attrType]].toString();
                    }
                }
            }

            $q.when(spyreqs.rest.addHostListItem($scope.listTitle, itemToCreate))
                .then(function(data) {
                    say(data);
                    addItems(items);
                });

        } else {
            say('Added all items');
        }
    }

    function valueToLabel(attrName, value) {
        var i, len, pairs;

        for (i = 0, len = optionSets.length; i < len; i++) {
            if (optionSets[i].name === attrName) {
                pairs = optionSets[i].data;
                break;
            }
        }

        for (i = 0, len = pairs.length; i < len; i++) {
            if (pairs[i].value === value) {
                return pairs[i].label;
            }
        }
    }

    $scope.clone = function() {
        var list = {
            Title: $scope.listTitle,
            Template: 100
        };

        $q.when(spyreqs.rest.createHostList(list)).then(function(listData) {
            var listGuid = listData.d.Id,
                attributes;

            itemType = listData.d.ListItemEntityTypeFullName;

            attributes = angular.copy($scope.attributesArray);

            createFields(listGuid, attributes);

            say(listData);

        }, function(error) {
            say(error);
        });
    };

});

app.controller('lessonsCtrl', function($scope, $q) {
    "use strict";

    $scope.lessons = "Just a Lessons List";

    function getLessons() {
        $scope.items = [];
        $q.when(spyreqs.rest.getHostListItems('Lessons', '$select=Title,Id')).then(function(data) {
            say(data);

            $scope.items = data.d.results;
        });
    }

    $scope.updateList = function() {
        $q.when(spyreqs.rest.getHostListByTitle('Lessons1', '')).
        then(function(data) {
            var listData = {
                Title: "Lessons",
                __metadata: data.d.__metadata
            };

            say(data);

            return $q.when(spyreqs.rest.updateHostList('Lessons1', listData));
        }).
        then(function() {
            say("List Updated");
        });
    };

    $scope.delete = function(index, item) {
        $q.when(spyreqs.rest.deleteHostListItem('Lessons', item.Id, item.__metadata.etag)).
        then(function() {
            $scope.items.splice(index, 1);
        }, function(error) {
            say(error);
        });
    };

    $scope.update = function(item) {

        var upItem = {
            Title: "new " + item.Title,
            Id: item.Id,
            __metadata: item.__metadata
        };

        $q.when(spyreqs.rest.updateHostListItem("Lessons", upItem)).then(function(data) {
            say('Item Updated' + data);
            getLessons();
        }, function(error) {
            say(error);
        });
    };

    getLessons();
});

app.controller('addItem', function($scope, $location, $q) {
    "use strict";

    $scope.add = function() {
        var item = {
            Title: $scope.Title,
            "__metadata": {
                type: "SP.Data.LessonsListItem"
            }
        };
        say(item);

        $q.when(spyreqs.rest.addHostListItem('Lessons', item)).
        then(function(data) {
            say(data);

            $location.path('/lessons');

            say($location.path());
        }, function(error) {
            say(error);
        });
    };
});