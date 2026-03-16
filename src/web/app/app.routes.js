(function () {
  'use strict';

  angular
    .module('helmosApp')
    .config(routeConfig);

  routeConfig.$inject = ['$locationProvider', '$routeProvider'];

  function routeConfig($locationProvider, $routeProvider) {
    $locationProvider.html5Mode(true);

    $routeProvider
      .when('/', {
        template: '<home-page></home-page>'
      })
      .otherwise({
        redirectTo: '/'
      });
  }
})();
