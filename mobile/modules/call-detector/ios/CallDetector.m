#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Bridge ObjC pentru CallDetector (Swift). RCT_EXTERN_MODULE inregistreaza
// modulul la +load — TurboModule registry-ul il rezolva pe New Arch.
@interface RCT_EXTERN_MODULE(CallDetector, RCTEventEmitter)

RCT_EXTERN_METHOD(getCurrentState:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup { return YES; }

@end
