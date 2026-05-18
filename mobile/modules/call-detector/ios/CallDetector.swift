import Foundation
import CallKit
import React

// Observer pasiv de apeluri via CallKit. Nu necesita permisiuni — CXCallObserver
// e public API si raporteaza apeluri telefonice (GSM/VoIP integrat CallKit).
// Folosit la Phone Down: cand suna parintii, intram in pauza in loc sa
// penalizam user-ul.
//
// Event: "callStateChanged" cu body { "inCall": Bool }. Idle = niciun call
// activ; inCall = exista cel putin un CXCall non-ended.
@objc(CallDetector)
class CallDetector: RCTEventEmitter, CXCallObserverDelegate {

  private let callObserver = CXCallObserver()
  private var hasListeners = false
  private var lastInCall = false

  override init() {
    super.init()
    // Observer-ul se ataseaza pe main queue ca sa primeasca callback-uri pe
    // thread-ul UI — recomandat de Apple in CallKit docs.
    callObserver.setDelegate(self, queue: nil)
  }

  override static func requiresMainQueueSetup() -> Bool { return true }

  override func supportedEvents() -> [String]! {
    return ["callStateChanged"]
  }

  override func startObserving() {
    hasListeners = true
    // Emite starea curenta la subscribe ca consumatorul sa primeasca imediat
    // un snapshot fara sa astepte un event tranzitiv.
    emitCurrent()
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(getCurrentState:reject:)
  func getCurrentState(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
    resolve(["inCall": computeInCall()])
  }

  // iOS nu cere permisiune runtime pentru CXCallObserver, deci no-op resolve.
  // Pastrat in API pentru simetrie cu Android (READ_PHONE_STATE).
  @objc(requestPermission:reject:)
  func requestPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
    emitCurrent()
  }

  private func computeInCall() -> Bool {
    for call in callObserver.calls {
      if !call.hasEnded { return true }
    }
    return false
  }

  private func emitCurrent() {
    let now = computeInCall()
    // Evitam emiterea repetata cand starea nu se schimba (CXCallObserver
    // poate trimite callback-uri intermediare cu acelasi outcome agregat).
    if now == lastInCall { return }
    lastInCall = now
    if hasListeners {
      sendEvent(withName: "callStateChanged", body: ["inCall": now])
    }
  }
}
