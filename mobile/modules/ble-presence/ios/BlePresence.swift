import Foundation
import CoreBluetooth
import React

@objc(BlePresence)
class BlePresence: RCTEventEmitter, CBPeripheralManagerDelegate {

  private var peripheralManager: CBPeripheralManager?
  private var pendingServiceUuid: String?
  private var pendingLocalName: String?
  private var hasListeners = false
  private var lastError: String?

  override init() {
    super.init()
    let setup = { [weak self] in
      guard let self = self else { return }
      self.peripheralManager = CBPeripheralManager(delegate: self, queue: nil, options: nil)
    }
    if Thread.isMainThread {
      setup()
    } else {
      DispatchQueue.main.sync(execute: setup)
    }
  }

  override static func requiresMainQueueSetup() -> Bool { return true }

  override func supportedEvents() -> [String]! {
    return ["onAdvertiseStateChanged"]
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving() { hasListeners = false }

  @objc(startAdvertising:localName:resolve:reject:)
  func startAdvertising(_ serviceUuid: String,
                        localName: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard CBUUID.fromOptional(serviceUuid) != nil else {
      reject("INVALID_UUID", "Invalid serviceUuid: \(serviceUuid)", nil)
      return
    }
    pendingServiceUuid = serviceUuid
    pendingLocalName = localName

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      guard let mgr = self.peripheralManager else {
        reject("NOT_READY", "PeripheralManager not initialized", nil)
        return
      }
      if mgr.state == .poweredOn {
        self.applyAdvertising()
        resolve(nil)
      } else {
        // Va porni in didUpdateState cand devine poweredOn.
        resolve(nil)
      }
    }
  }

  @objc(stopAdvertising:reject:)
  func stopAdvertising(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      self?.peripheralManager?.stopAdvertising()
      self?.pendingServiceUuid = nil
      self?.pendingLocalName = nil
      resolve(nil)
    }
  }

  @objc(getState:reject:)
  func getState(_ resolve: @escaping RCTPromiseResolveBlock,
                reject: @escaping RCTPromiseRejectBlock) {
    let stateStr: String
    switch peripheralManager?.state ?? .unknown {
    case .poweredOn: stateStr = "poweredOn"
    case .poweredOff: stateStr = "poweredOff"
    case .unauthorized: stateStr = "unauthorized"
    case .unsupported: stateStr = "unsupported"
    case .resetting: stateStr = "resetting"
    case .unknown: stateStr = "unknown"
    @unknown default: stateStr = "unknown"
    }
    resolve([
      "state": stateStr,
      "isAdvertising": peripheralManager?.isAdvertising ?? false,
      "lastError": lastError as Any
    ])
  }

  private func applyAdvertising() {
    guard let mgr = peripheralManager,
          let uuidStr = pendingServiceUuid,
          let cbuuid = CBUUID.fromOptional(uuidStr) else { return }
    let name = pendingLocalName ?? ""
    var adv: [String: Any] = [CBAdvertisementDataServiceUUIDsKey: [cbuuid]]
    if !name.isEmpty {
      adv[CBAdvertisementDataLocalNameKey] = name
    }
    if mgr.isAdvertising {
      mgr.stopAdvertising()
    }
    mgr.startAdvertising(adv)
    lastError = nil
  }

  // CBPeripheralManagerDelegate
  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOn, pendingServiceUuid != nil {
      applyAdvertising()
    }
    if hasListeners {
      sendEvent(withName: "onAdvertiseStateChanged",
                body: ["state": stateString(peripheral.state)])
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager,
                                            error: Error?) {
    if let error = error {
      lastError = error.localizedDescription
    } else {
      lastError = nil
    }
  }

  private func stateString(_ s: CBManagerState) -> String {
    switch s {
    case .poweredOn: return "poweredOn"
    case .poweredOff: return "poweredOff"
    case .unauthorized: return "unauthorized"
    case .unsupported: return "unsupported"
    case .resetting: return "resetting"
    case .unknown: return "unknown"
    @unknown default: return "unknown"
    }
  }
}

private extension CBUUID {
  static func fromOptional(_ s: String) -> CBUUID? {
    let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    return CBUUID(string: trimmed)
  }
}
