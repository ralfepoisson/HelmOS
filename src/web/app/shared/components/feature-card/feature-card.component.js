(function () {
  'use strict';

  angular
    .module('helmosApp.shared')
    .component('featureCard', {
      bindings: {
        feature: '<'
      },
      templateUrl: 'app/shared/components/feature-card/feature-card.template.html'
    });
})();
