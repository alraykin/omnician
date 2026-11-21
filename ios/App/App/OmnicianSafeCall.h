#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Runs `block` inside `@try/@catch` so UIKit hinge/crease assertions
/// cannot take down the process. Swift cannot catch NSException.
@interface OmnicianSafeCall : NSObject
+ (BOOL)run:(void (NS_NOESCAPE ^)(void))block;
@end

NS_ASSUME_NONNULL_END
