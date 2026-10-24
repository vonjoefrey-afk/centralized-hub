/**
 * Test script to verify error logging integration works locally
 * Run this in browser console after the app loads: npm start
 * 
 * Or test via curl/Postman to the Cloud Function directly
 */

// Test 1: Test Cloud Function directly
const testCloudFunction = async () => {
  console.log('🧪 Test 1: Testing Cloud Function directly...');
  
  const testLog = {
    severity: 'INFO',
    message: 'Test log from local environment',
    context: {
      test: true,
      timestamp: new Date().toISOString(),
      environment: 'development',
      source: 'manual-test-script'
    }
  };

  try {
    const response = await fetch('https://asia-southeast1-centralized-gcp.cloudfunctions.net/logToCloudLogging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testLog),
    });

    const result = await response.json();
    console.log('✅ Cloud Function Response:', result);
    return true;
  } catch (error) {
    console.error('❌ Cloud Function Test Failed:', error);
    return false;
  }
};

// Test 2: Test error logging from React app context
const testErrorLogging = async () => {
  console.log('🧪 Test 2: Testing error logging integration...');
  
  // Simulate an error
  const testError = new Error('Test error for logging verification');
  testError.code = 'test/error-code';
  
  // Import the logging function (this would be done in React app)
  // In browser console, you would do:
  // import { logError } from './utils/gcp-logging';
  // await logError(testError, { test: true, source: 'browser-console-test' });
  
  console.log('📝 To test in React app, open browser console and run:');
  console.log(`
    import { logError, LOG_LEVELS } from './utils/gcp-logging';
    const testErr = new Error('Test error');
    await logError(testErr, { test: true });
  `);
  
  return true;
};

// Run tests
(async () => {
  console.log('🚀 Starting Error Logging Tests...\n');
  
  const test1Result = await testCloudFunction();
  await testErrorLogging();
  
  console.log('\n📊 Test Summary:');
  console.log(`  Cloud Function: ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Error Logging: ⚠️  Manual test required (see instructions above)`);
  
  console.log('\n📋 Next Steps:');
  console.log('  1. Open http://localhost:3000 in your browser');
  console.log('  2. Open browser DevTools Console (F12)');
  console.log('  3. Run the test commands shown above');
  console.log('  4. Check Cloud Logging Console: https://console.cloud.google.com/logs?project=centralized-gcp');
  console.log('  5. Verify logs appear within 1-2 minutes');
})();
