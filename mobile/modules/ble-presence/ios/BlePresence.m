#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Bridge ObjC: RCT_EXTERN_MODULE inregistreaza modulul automat la +load —
// New Arch face fallback la registry-ul de bridge si TurboModule-ul se rezolva.
@interface RCT_EXTERN_MODULE(BlePresence, RCTEventEmitter)

RCT_EXTERN_METHOD(startAdvertising:(NSString *)serviceUuid
                  localName:(NSString *)localName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopAdvertising:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getState:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup { return YES; }

@end
