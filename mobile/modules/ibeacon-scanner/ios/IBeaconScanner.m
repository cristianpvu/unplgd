#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Bridge ObjC pentru clasa Swift IBeaconScanner. RCT_EXTERN_MODULE inregistreaza
// modulul automat la +load (deci si New Arch face fallback la registry-ul de
// bridge si TurboModule-ul se rezolva fara nevoie de RCTAppDependencyProvider).
@interface RCT_EXTERN_MODULE(IBeaconScanner, RCTEventEmitter)

RCT_EXTERN_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startRanging:(NSString *)uuidString
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRanging:(NSString *)uuidString
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopAll:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup { return YES; }

@end
