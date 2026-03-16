(function () {
  'use strict';

  angular
    .module('helmosApp.shared')
    .component('trustLogoStrip', {
      bindings: {
        logos: '<'
      },
      templateUrl: 'app/shared/components/trust-logo-strip/trust-logo-strip.template.html'
    });
})();
