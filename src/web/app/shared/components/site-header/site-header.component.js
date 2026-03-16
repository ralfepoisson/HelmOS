(function () {
  'use strict';

  angular
    .module('helmosApp.shared')
    .component('siteHeader', {
      bindings: {
        navigation: '<',
        cta: '<'
      },
      controller: SiteHeaderController,
      templateUrl: 'app/shared/components/site-header/site-header.template.html'
    });

  function SiteHeaderController() {
    var $ctrl = this;

    $ctrl.isMenuOpen = false;
    $ctrl.toggleMenu = toggleMenu;
    $ctrl.closeMenu = closeMenu;

    function toggleMenu() {
      $ctrl.isMenuOpen = !$ctrl.isMenuOpen;
    }

    function closeMenu() {
      $ctrl.isMenuOpen = false;
    }
  }
})();
