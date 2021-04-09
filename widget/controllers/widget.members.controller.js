'use strict';

(function (angular) {
    angular.module('socialPluginWidget')
        .controller('MembersCtrl', ['$scope', '$rootScope', '$routeParams', 'Buildfire', 'SubscribedUsersData', 'SocialItems', function ($scope, $rootScope, $routeParams, Buildfire, SubscribedUsersData, SocialItems) {

            var Members = this;
            Members.userDetails = {};
            Members.users = [];
            Members.wallId = null;
            Members.showMore = false;
            Members.noResultsText = null;
            Members.searchOptions = {
                pageSize: 50,
                page: 0
            }
            Members.context = null;
            Members.languages = null;
            Members.appSettings = null;
            Members.SocialItems = SocialItems.getInstance();

            Members.init = function () {
                $rootScope.showThread = false;

                Buildfire.appearance.getAppTheme((err, obj) => {
                    if (err) return console.log(err);
                    document.getElementsByClassName("glyphicon")[0].style.setProperty("color", obj.colors.icons);
                });

                Members.appSettings = Members.SocialItems.appSettings;
                Members.languages = Members.SocialItems.languages.membersBlankState;

                if ($routeParams.wallId === "home") Members.wallId = "";
                else Members.wallId = $routeParams.wallId;
                Members.SocialItems.authenticateUser(null, (err, user) => {
                    if (err) return console.error("Getting user failed.", err);
                    if (user) {
                        SubscribedUsersData.getUsersWhoFollow(user._id, Members.wallId, function (err, users) {
                            if (err) return console.log(err);
                            Members.users = users;
                            $scope.$digest();
                        });
                    }
                });
            }

            $scope.clear = function () {
                $scope.searchInput = "";
                Members.noResultsText = Members.languages.membersBlankState;
                Members.searchOptions.page = 0;
                SubscribedUsersData.getUsersWhoFollow(Members.userDetails._id, Members.wallId, function (err, users) {
                    if (err) return console.log(err);
                    Members.users = users;
                    $scope.$digest();
                });
            }

            $scope.onSearchChange = function () {
                let isEmptySearch = ($scope.searchInput.length === 0);
                let minSearchLength = 1;
                if ($scope.searchInput.length === minSearchLength && !isEmptySearch) return;

                Members.searchOptions.filter = {
                    '_buildfire.index.string1': Members.wallId ? Members.wallId : { "$eq": "" },
                    $or: [

                        { "$json.userDetails.displayName": { $regex: $scope.searchInput, $options: 'i' } },
                        { "$json.userDetails.firstName": { $regex: $scope.searchInput, $options: 'i' } },
                        { "$json.userDetails.lastName": { $regex: $scope.searchInput, $options: 'i' } },
                        { "$json.userDetails.email": { $regex: $scope.searchInput, $options: 'i' } },
                    ]
                }
                Members.searchOptions.page = 0;
                Members.executeSearch(Members.searchOptions);
            };

            Members.executeSearch = function (query) {
                Buildfire.spinner.show();
                SubscribedUsersData.searchForUsers(query, function (err, users) {
                    if (err) return console.log(err);
                    if (users.length === Members.searchOptions.pageSize) {
                        Members.searchOptions.page++;
                        Members.showMore = true;
                    }
                    else if (users.length === 0) {
                        Members.noResultsText = Members.languages.membersNoResults;
                    }
                    else {
                        Members.showMore = false;
                    }

                    Members.users = users.filter(el => el.userId !== Members.SocialItems.userDetails.userId);
                    Buildfire.spinner.hide();
                    $scope.$digest();
                })
            }

            Members.loadMore = function () {
                SubscribedUsersData.searchForUsers(Members.searchOptions, function (err, users) {
                    if (err) return console.log(err);
                    users.map(user => {
                        Members.users.push(user)
                    })
                    if (users.length === Members.searchOptions.pageSize) {
                        Members.searchOptions.page++;
                        Members.showMore = true;
                    } else {
                        Members.showMore = false;
                    }
                    $scope.$digest();
                });
            }


            Buildfire.datastore.onUpdate(function (response) {
                if (response.tag === "languages") {
                    let languages = {};
                    Object.keys(response.data.screenOne).forEach(e => {
                        response.data.screenOne[e].value ? languages[e] = response.data.screenOne[e].value : languages[e] = response.data.screenOne[e].defaultValue;
                    });
                    Members.languages = languages;
                    Members.noResultsText = languages.membersBlankState;
                    $scope.$digest();
                }
                else if (response.tag === "Social") {
                    Members.appSettings = response.data.appSettings;
                    $scope.$digest();
                }
            });

            Members.followPrivateWall = function (userId, wid, userName = null) {
                buildfire.auth.getUserProfile({ userId: userId }, (err, user) => {
                    if (err) console.log('Error while saving subscribed user data.');
                    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    if (re.test(String(user.firstName).toLowerCase()))
                        user.firstName = 'Someone';
                    if (re.test(String(user.displayName).toLowerCase()))
                        user.displayName = 'Someone';

                    var params = {
                        userId: userId,
                        userDetails: {
                            displayName: user.displayName,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            imageUrl: user.imageUrl,
                            email: user.email,
                            lastUpdated: new Date().getTime(),
                        },
                        wallId: wid,
                        posts: [],
                        _buildfire: {
                            index: { text: userId + '-' + wid, string1: wid }
                        }
                    };

                    userName = Members.SocialItems.getUserName(params.userDetails)
                    SubscribedUsersData.save(params, function (err) {
                        if (err) console.log('Error while saving subscribed user data.');
                        if (userName)
                            Members.navigateToPrivateChat({ id: userId, name: userName, wid: wid });
                    });
                })
            }

            Members.navigateToPrivateChat = function(user) {
                Members.SocialItems.isPrivateChat = true;
                Members.SocialItems.items = [];
                Members.SocialItems.wid = user.wid;
                Members.SocialItems.pageSize = 5;
                Members.SocialItems.page = 0;
                $rootScope.showThread = true;
                $rootScope.$broadcast("loadPrivateChat");
                buildfire.history.push(Members.SocialItems.getUserName(Members.SocialItems.userDetails) + ' | ' + Members.SocialItems.getUserName(user.name), {
                    isPrivateChat: true,
                    showLabelInTitlebar: true
                });
            }

            Members.openPrivateChat = function (user) {
                if (Members.appSettings && Members.appSettings.disablePrivateChat) return;
                Members.SocialItems.authenticateUser(null, (err, userData) => {
                    if (err) return console.error("Getting user failed.", err);
                    if (userData) {
                        let wid = null;

                        if (Members.SocialItems.userDetails.userId && Members.SocialItems.userDetails.userId
                            != user.userId) {
                            if (Members.SocialItems.userDetails.userId > user.userId)
                                wid = Members.SocialItems.userDetails.userId + user.userId;
                            else
                                wid = user.userId + Members.SocialItems.userDetails.userId;
                                console.log(wid)

                               let userName = Members.SocialItems.getUserName(user.userDetails)

                            SubscribedUsersData.getGroupFollowingStatus(user.userId, wid, Members.SocialItems.context.instanceId, function (err, status) {
                                if (err) console.error('Error while getting initial group following status.', err);
                                console.log(user, status)
                                if (!status.length) {
                                    Members.followPrivateWall(user.userId, wid, userName);
                                } else {
                                    Members.navigateToPrivateChat({ id: user.userId, name: userName, wid: wid });
                                }
                            });

                        }
                    }
                });
            };

            Members.init();
        }])
})(window.angular);