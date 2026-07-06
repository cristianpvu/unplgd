// Config plugin: injecteaza permisiunea speciala PACKAGE_USAGE_STATS in
// AndroidManifest cu tools:ignore="ProtectedPermissions". Fara asta, app-ul NU
// apare in Settings → Special app access → Usage access, deci userul nu poate
// acorda accesul la timpul pe ecran. Expo nu o adauga corect din
// android.permissions (e signature/protected permission) → o facem aici.

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.PACKAGE_USAGE_STATS';
const TOOLS_NS = 'http://schemas.android.com/tools';

module.exports = function withUsageStatsPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Asigura namespace-ul tools pe <manifest> ca tools:ignore sa fie valid.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = TOOLS_NS;
    }

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const existing = manifest['uses-permission'].find(
      (p) => p.$ && p.$['android:name'] === PERMISSION,
    );
    if (existing) {
      existing.$['tools:ignore'] = 'ProtectedPermissions';
    } else {
      manifest['uses-permission'].push({
        $: {
          'android:name': PERMISSION,
          'tools:ignore': 'ProtectedPermissions',
        },
      });
    }

    return cfg;
  });
};
