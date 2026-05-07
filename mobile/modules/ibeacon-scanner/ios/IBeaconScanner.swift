import Foundation
import CoreLocation
import React

// Modul nativ minimalist care expune CLLocationManager.startRangingBeacons
// catre RN. Necesar pentru ca pe iOS Apple ascunde iBeacon advertising packets
// din scanul generic al CBCentralManager (folosit de ble-plx). Singurul API
// public iOS care vede iBeacons este Core Location ranging — pe care il
// expunem aici.
@objc(IBeaconScanner)
class IBeaconScanner: RCTEventEmitter, CLLocationManagerDelegate {

  private var locationManager: CLLocationManager?
  private var rangedConstraints: [String: CLBeaconIdentityConstraint] = [:]
  private var hasListeners = false

  override init() {
    super.init()
    let setup = { [weak self] in
      guard let self = self else { return }
      let mgr = CLLocationManager()
      mgr.delegate = self
      self.locationManager = mgr
    }
    if Thread.isMainThread {
      setup()
    } else {
      DispatchQueue.main.sync(execute: setup)
    }
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["onBeaconsRanged", "onAuthorizationChanged"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // Cere permisiunea Location "When in Use". Apple cere ca dialogul sa fie
  // declansat din context de UI; in practica functioneaza si in JS-thread context
  // pentru ca tot pe main queue executam aici.
  @objc(requestPermission:reject:)
  func requestPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      self?.locationManager?.requestWhenInUseAuthorization()
      let status: CLAuthorizationStatus
      if #available(iOS 14.0, *) {
        status = self?.locationManager?.authorizationStatus ?? .notDetermined
      } else {
        status = CLLocationManager.authorizationStatus()
      }
      resolve(IBeaconScanner.statusString(status))
    }
  }

  @objc(getAuthorizationStatus:reject:)
  func getAuthorizationStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
    let status: CLAuthorizationStatus
    if #available(iOS 14.0, *) {
      status = locationManager?.authorizationStatus ?? .notDetermined
    } else {
      status = CLLocationManager.authorizationStatus()
    }
    resolve(IBeaconScanner.statusString(status))
  }

  @objc(startRanging:resolve:reject:)
  func startRanging(_ uuidString: String,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
    guard let uuid = UUID(uuidString: uuidString) else {
      reject("INVALID_UUID", "Invalid UUID: \(uuidString)", nil)
      return
    }
    let key = uuidString.lowercased()
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      // Idempotenta: daca avem deja ranging pe acelasi UUID, oprim si repornim
      // pt a evita "leaked" constraint-uri intre cycle de start/stop pe JS.
      if let existing = self.rangedConstraints[key] {
        self.locationManager?.stopRangingBeacons(satisfying: existing)
        self.rangedConstraints.removeValue(forKey: key)
      }
      let constraint = CLBeaconIdentityConstraint(uuid: uuid)
      self.rangedConstraints[key] = constraint
      self.locationManager?.startRangingBeacons(satisfying: constraint)
      resolve(nil)
    }
  }

  @objc(stopRanging:resolve:reject:)
  func stopRanging(_ uuidString: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
    let key = uuidString.lowercased()
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      if let constraint = self.rangedConstraints[key] {
        self.locationManager?.stopRangingBeacons(satisfying: constraint)
        self.rangedConstraints.removeValue(forKey: key)
      }
      resolve(nil)
    }
  }

  @objc(stopAll:reject:)
  func stopAll(_ resolve: @escaping RCTPromiseResolveBlock,
               reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      for (_, constraint) in self.rangedConstraints {
        self.locationManager?.stopRangingBeacons(satisfying: constraint)
      }
      self.rangedConstraints.removeAll()
      resolve(nil)
    }
  }

  // CLLocationManagerDelegate

  func locationManager(_ manager: CLLocationManager,
                       didRange beacons: [CLBeacon],
                       satisfying beaconConstraint: CLBeaconIdentityConstraint) {
    guard hasListeners else { return }
    let uuidStr = beaconConstraint.uuid.uuidString.lowercased()
    let payload: [[String: Any]] = beacons.map { beacon in
      [
        "uuid": beacon.uuid.uuidString.lowercased(),
        "major": beacon.major.intValue,
        "minor": beacon.minor.intValue,
        // CLBeacon.rssi e int dBm; 0 inseamna "necunoscut" (foarte rar).
        "rssi": beacon.rssi,
        // CLBeacon.accuracy = distanta estimata in metri (poate fi -1 daca
        // nedeterminat); il trimitem brut, JS-ul filtreaza daca trebuie.
        "accuracy": beacon.accuracy,
      ]
    }
    sendEvent(withName: "onBeaconsRanged", body: ["uuid": uuidStr, "beacons": payload])
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard hasListeners else { return }
    let status: CLAuthorizationStatus
    if #available(iOS 14.0, *) {
      status = manager.authorizationStatus
    } else {
      status = CLLocationManager.authorizationStatus()
    }
    sendEvent(withName: "onAuthorizationChanged",
              body: ["status": IBeaconScanner.statusString(status)])
  }

  static func statusString(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "whenInUse"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
}
