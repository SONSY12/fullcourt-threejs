#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface FCAppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@end

@implementation FCAppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.defaultWebpagePreferences.allowsContentJavaScript = YES;
    [configuration.userContentController addScriptMessageHandler:self name:@"nativeLog"];
    WKUserScript *errorBridge = [[WKUserScript alloc]
        initWithSource:@"window.addEventListener('error',e=>webkit.messageHandlers.nativeLog.postMessage('JS error: '+e.message));window.addEventListener('unhandledrejection',e=>webkit.messageHandlers.nativeLog.postMessage('Promise rejection: '+String(e.reason)));"
        injectionTime:WKUserScriptInjectionTimeAtDocumentStart
        forMainFrameOnly:YES];
    [configuration.userContentController addUserScript:errorBridge];

    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.webView.navigationDelegate = self;

    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1280, 800)
                                                styleMask:NSWindowStyleMaskTitled |
                                                          NSWindowStyleMaskClosable |
                                                          NSWindowStyleMaskMiniaturizable |
                                                          NSWindowStyleMaskResizable
                                                  backing:NSBackingStoreBuffered
                                                    defer:NO];
    self.window.title = @"Full Court 3D";
    self.window.minSize = NSMakeSize(960, 640);
    self.window.contentView = self.webView;
    [self.window center];
    [self.window makeKeyAndOrderFront:nil];

    NSURL *webDirectory = [NSBundle.mainBundle.resourceURL URLByAppendingPathComponent:@"web"];
    NSURL *indexURL = [webDirectory URLByAppendingPathComponent:@"index.html"];
    if (![NSFileManager.defaultManager fileExistsAtPath:indexURL.path]) {
        [self showLoadError:@"게임 리소스를 찾을 수 없습니다."];
        return;
    }

    [self.webView loadFileURL:indexURL allowingReadAccessToURL:webDirectory];
    [self.window makeFirstResponder:self.webView];
    [NSApp activateIgnoringOtherApps:YES];
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    fprintf(stderr, "%s\n", [[message.body description] UTF8String]);
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if ([NSProcessInfo.processInfo.environment[@"FULLCOURT_AUTOSTART"] isEqualToString:@"1"]) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [webView evaluateJavaScript:@"document.getElementById('start')?.click()" completionHandler:nil];
        });
    }
    NSString *snapshotPath = NSProcessInfo.processInfo.environment[@"FULLCOURT_SNAPSHOT_PATH"];
    if (snapshotPath.length == 0) return;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [webView takeSnapshotWithConfiguration:nil completionHandler:^(NSImage *image, NSError *error) {
            if (error) {
                fprintf(stderr, "Snapshot error: %s\n", error.localizedDescription.UTF8String);
                return;
            }
            NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithData:image.TIFFRepresentation];
            NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
            [png writeToFile:snapshotPath atomically:YES];
            fprintf(stderr, "Snapshot saved: %s\n", snapshotPath.UTF8String);
        }];
    });
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    [self showLoadError:error.localizedDescription];
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    [self showLoadError:error.localizedDescription];
}

- (void)showLoadError:(NSString *)message {
    NSAlert *alert = [NSAlert new];
    alert.messageText = @"Full Court 3D를 불러오지 못했습니다.";
    alert.informativeText = message;
    [alert runModal];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        FCAppDelegate *delegate = [FCAppDelegate new];
        application.delegate = delegate;
        [application setActivationPolicy:NSApplicationActivationPolicyRegular];
        [application run];
    }
    return 0;
}
