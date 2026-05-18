package com.calldetector

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

// Detecteaza apeluri telefonice (incoming + outgoing). Foloseste
// TelephonyCallback pe Android 12+ (API 31), PhoneStateListener pe API < 31
// (deprecated dar functional). Emite event "callStateChanged" cu body
// { inCall: boolean }. RINGING + OFFHOOK = inCall; IDLE = !inCall.
//
// READ_PHONE_STATE e necesar pe Android 10+ ca sistemul sa notifice
// schimbarile de stare. Pe < 10 functioneaza fara, dar tot cerem pentru
// uniformitate.
class CallDetectorModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var telephonyManager: TelephonyManager? = null
  private var legacyListener: PhoneStateListener? = null
  private var modernCallback: TelephonyCallback? = null
  private var registered = false
  private var lastInCall = false

  override fun getName(): String = "CallDetector"

  private fun hasPermission(): Boolean {
    return ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.READ_PHONE_STATE
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun getTelephony(): TelephonyManager? {
    if (telephonyManager == null) {
      telephonyManager =
        reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    }
    return telephonyManager
  }

  // Pe Android 12+ (API 31), PhoneStateListener e deprecated si poate fi
  // refuzat de OEM-uri stricte; TelephonyCallback e calea recomandata.
  @Suppress("DEPRECATION")
  private fun register() {
    if (registered) return
    if (!hasPermission()) return
    val tm = getTelephony() ?: return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) {
          handleState(state)
        }
      }
      modernCallback = cb
      try {
        tm.registerTelephonyCallback(reactContext.mainExecutor, cb)
        registered = true
      } catch (_: SecurityException) {
        // Permisiunea poate fi revocata intre check si register; ignoram.
      }
    } else {
      val listener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
          handleState(state)
        }
      }
      legacyListener = listener
      try {
        tm.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        registered = true
      } catch (_: SecurityException) {}
    }
  }

  @Suppress("DEPRECATION")
  private fun unregister() {
    if (!registered) return
    val tm = telephonyManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      modernCallback?.let { tm?.unregisterTelephonyCallback(it) }
      modernCallback = null
    } else {
      legacyListener?.let { tm?.listen(it, PhoneStateListener.LISTEN_NONE) }
      legacyListener = null
    }
    registered = false
  }

  private fun handleState(state: Int) {
    val inCall = state == TelephonyManager.CALL_STATE_RINGING ||
      state == TelephonyManager.CALL_STATE_OFFHOOK
    if (inCall == lastInCall) return
    lastInCall = inCall
    val params = Arguments.createMap().apply { putBoolean("inCall", inCall) }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("callStateChanged", params)
  }

  @ReactMethod
  fun getCurrentState(promise: Promise) {
    val tm = getTelephony()
    if (tm == null) {
      val map = Arguments.createMap().apply { putBoolean("inCall", false) }
      promise.resolve(map)
      return
    }
    if (!hasPermission()) {
      // Fara permisiune nu putem citi state real; consideram idle ca sa nu
      // intram in pauza permanenta.
      val map = Arguments.createMap().apply { putBoolean("inCall", false) }
      promise.resolve(map)
      return
    }
    val state = try {
      @Suppress("DEPRECATION")
      tm.callState
    } catch (_: SecurityException) {
      TelephonyManager.CALL_STATE_IDLE
    }
    val inCall = state == TelephonyManager.CALL_STATE_RINGING ||
      state == TelephonyManager.CALL_STATE_OFFHOOK
    lastInCall = inCall
    val map = Arguments.createMap().apply { putBoolean("inCall", inCall) }
    promise.resolve(map)
  }

  // Pe Android, permisiunea READ_PHONE_STATE e runtime. Cererea efectiva o
  // facem din JS prin PermissionsAndroid — aici doar raportam daca o avem,
  // ca JS-ul sa decida daca trebuie sa intrebe user-ul.
  @ReactMethod
  fun requestPermission(promise: Promise) {
    promise.resolve(hasPermission())
  }

  // Pornit/oprit ascultare. Apelat de JS la mount/unmount al hook-ului.
  @ReactMethod
  fun startListening(promise: Promise) {
    register()
    promise.resolve(registered)
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    unregister()
    promise.resolve(true)
  }

  // RN new arch cere ambele metode chiar si pentru module care nu emit
  // events din addListener/removeListeners explicit (folosim emit direct).
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  override fun invalidate() {
    unregister()
    super.invalidate()
  }
}
