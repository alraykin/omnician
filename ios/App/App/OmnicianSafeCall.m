#import "OmnicianSafeCall.h"

@implementation OmnicianSafeCall

+ (BOOL)run:(void (NS_NOESCAPE ^)(void))block {
    @try {
        block();
        return YES;
    } @catch (NSException *exception) {
        NSLog(@"OmnicianPosture: swallowed %@ %@", exception.name, exception.reason ?: @"");
        return NO;
    }
}

@end
