package com.blepresence

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.nio.charset.StandardCharsets
import java.util.UUID

// Modul nativ care face advertise BLE GATT cu Service UUID + Service Data.
// Service Data poarta token-ul (ASCII bytes), accesibil pe scan-uri ble-plx pe
// ambele platforme.
//
// Layout pachete (legacy BLE 4.x, 31 bytes / pachet):
//   - ADV packet: flags (3B) + complete service UUID 128-bit (18B) = 21B ✓
//   - SCAN RESPONSE: service data 128-bit + 8B token = 26B ✓
//
// De ce split: daca puneam si Service UUID si Service Data in advertise (cum
// era inainte) = 47B > 31B → ADVERTISE_FAILED_DATA_TOO_LARGE (errCode=1) si
// peer-ul nu ne vede deloc. iOS scan filter matcheaza pe Service UUID din ADV,
// iar scan response e absorbit automat in `device.serviceData` la peer.
//
// Connectable=true e cerut ca scan response sa functioneze fiabil pe toate
// chipset-urile Android (ADV_IND vs ADV_SCAN_IND varianta non-connectable e
// bugoasa pe unele OEM-uri). Nu expunem niciun GATT service → conexiunile
// sunt refuzate instant de stack si zero impact pe baterie/UX.
class BlePresenceModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var advertiser: BluetoothLeAdvertiser? = null
  private var currentCallback: AdvertiseCallback? = null
  private var lastError: String? = null

  override fun getName(): String = "BlePresence"

  private fun getAdapter(): BluetoothAdapter? {
    val mgr = reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return mgr?.adapter
  }

  @ReactMethod
  fun startAdvertising(serviceUuidStr: String, localName: String, promise: Promise) {
    val adapter = getAdapter()
    if (adapter == null || !adapter.isEnabled) {
      lastError = "Bluetooth adapter unavailable"
      promise.reject("BT_OFF", lastError)
      return
    }

    val advertiser = adapter.bluetoothLeAdvertiser
    if (advertiser == null) {
      lastError = "BluetoothLeAdvertiser not supported on this device"
      promise.reject("UNSUPPORTED", lastError)
      return
    }
    this.advertiser = advertiser

    // Stop any previous advertise — schimbarea de token cere reset complet.
    currentCallback?.let {
      try { advertiser.stopAdvertising(it) } catch (_: Throwable) {}
    }

    val parcelUuid = try {
      ParcelUuid(UUID.fromString(serviceUuidStr))
    } catch (e: Exception) {
      promise.reject("INVALID_UUID", "Invalid serviceUuid: $serviceUuidStr")
      return
    }

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
      .setConnectable(true)
      .setTimeout(0)
      .build()

    // ADV packet: doar Service UUID. Asta e ce matcheaza scan filter-ul pe
    // ambele platforme (iOS CBCentralManager.scanForPeripherals(withServices:)
    // si Android ScanFilter pe service UUID).
    val advertiseData = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .addServiceUuid(parcelUuid)
      .build()

    // SCAN RESPONSE: token-ul ca service data. Peer-ii fac active scan, iOS
    // si Android cer scan response automat dupa ce vad ADV_IND si combina
    // ambele in callback-ul de scan. Mobile-ul citeste serviceData[uuid].
    val tokenBytes = localName.toByteArray(StandardCharsets.US_ASCII)
    val scanResponse = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .addServiceData(parcelUuid, tokenBytes)
      .build()

    val callback = object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
        lastError = null
      }
      override fun onStartFailure(errorCode: Int) {
        lastError = "AdvertiseCallback onStartFailure code=$errorCode"
      }
    }
    currentCallback = callback

    try {
      advertiser.startAdvertising(settings, advertiseData, scanResponse, callback)
      promise.resolve(null)
    } catch (e: SecurityException) {
      // Lipseste BLUETOOTH_ADVERTISE runtime permission pe Android 12+.
      lastError = "Missing BLUETOOTH_ADVERTISE permission"
      promise.reject("PERMISSION", lastError)
    } catch (e: Exception) {
      lastError = e.message
      promise.reject("ADVERTISE_FAIL", e.message)
    }
  }

  @ReactMethod
  fun stopAdvertising(promise: Promise) {
    val advertiser = this.advertiser
    val callback = this.currentCallback
    if (advertiser != null && callback != null) {
      try { advertiser.stopAdvertising(callback) } catch (_: Throwable) {}
    }
    currentCallback = null
    promise.resolve(null)
  }

  @ReactMethod
  fun getState(promise: Promise) {
    val adapter = getAdapter()
    val state: String = when {
      adapter == null -> "unsupported"
      !adapter.isEnabled -> "poweredOff"
      else -> "poweredOn"
    }
    val map: WritableMap = Arguments.createMap()
    map.putString("state", state)
    map.putBoolean("isAdvertising", currentCallback != null)
    map.putString("lastError", lastError)
    promise.resolve(map)
  }

  // Pe RN new arch (TurboModules), addListener / removeListeners trebuie sa
  // existe ca metode chiar daca nu emit events din modulul asta — RN se
  // plange daca lipsesc.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
}
