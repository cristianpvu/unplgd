package com.screentime

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Citeste screen time-ul total al device-ului din UsageStatsManager. Permisiunea
// PACKAGE_USAGE_STATS NU e runtime — e "Usage access" (special app access), data
// manual de user din Settings. Deschidem ecranul cu openUsageAccessSettings().
//
// getScreenTimeMinutes(startMs, endMs) agrega totalTimeInForeground peste toate
// pachetele in fereastra → minute de utilizare. Aproximare standard pentru
// "screen time". Returneaza -1 cand lipseste permisiunea (JS-ul deruleaza spre
// ecranul de acces).
//
// iOS nu are echivalent public → modulul exista doar pe Android; pe iOS
// NativeModules.ScreenTime e undefined si JS-ul face gating.
class ScreenTimeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ScreenTime"

  private fun isUsageAccessGranted(): Boolean {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
      ?: return false
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        reactContext.packageName,
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        reactContext.packageName,
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    promise.resolve(isUsageAccessGranted())
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("settings_error", "Nu pot deschide ecranul de acces", e)
    }
  }

  // Minute de utilizare (foreground) in fereastra [startMs, endMs]. -1 daca
  // lipseste permisiunea. Numerele vin ca Double prin bridge.
  @ReactMethod
  fun getScreenTimeMinutes(startMs: Double, endMs: Double, promise: Promise) {
    if (!isUsageAccessGranted()) {
      promise.resolve(-1.0)
      return
    }
    val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
    if (usm == null) {
      promise.resolve(-1.0)
      return
    }
    try {
      val stats = usm.queryAndAggregateUsageStats(startMs.toLong(), endMs.toLong())
      var totalMs = 0L
      for ((_, u) in stats) {
        totalMs += u.totalTimeInForeground
      }
      promise.resolve((totalMs / 60000L).toDouble())
    } catch (e: Exception) {
      promise.reject("query_error", "Nu pot citi screen time-ul", e)
    }
  }

  // New arch cere stub-urile chiar daca nu emitem events.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
}
