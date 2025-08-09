const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_DATA = {
  admin: {
    email: 'rhmunna19@gmail.com',
    password: 'admin123'
  },
  testUser: {
    name: 'Test Student Auto',
    email: `test.student.${Date.now()}@university.edu`,
    password: 'test123'
  },
  testTeacher: {
    name: 'Dr. Test Teacher Auto',
    email: `test.teacher.${Date.now()}@university.edu`,
    password: 'teacher123',
    role: 'TEACHER'
  }
};

let adminToken = '';
let studentToken = '';
let teacherToken = '';
let createdUserId = null;
let createdProposalId = null;
let createdProjectBookId = null;

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

// Helper functions
const logTest = (name, success, details = '', fullError = null) => {
  if (success) {
    console.log(`✅ ${name}`);
    testResults.passed++;
  } else {
    console.log(`❌ ${name} - ${details}`);
    if (fullError) {
      console.log(`   Details:`, JSON.stringify(fullError, null, 2));
    }
    testResults.failed++;
    testResults.errors.push({ test: name, error: details, fullError });
  }
  testResults.details.push({ name, success, details, fullError });
};

const makeRequest = async (method, endpoint, data = null, token = null, isFormData = false) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      if (isFormData) {
        config.data = data;
        config.headers['Content-Type'] = 'multipart/form-data';
      } else {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message, 
      status: error.response?.status || 500,
      fullError: error.response?.data || error.message
    };
  }
};

// Test functions
const testHealthCheck = async () => {
  console.log('\n🔍 Testing System Health...');
  
  const result = await makeRequest('GET', '/');
  logTest('Health Check', result.success && result.status === 200, result.error);
};

const testAuthentication = async () => {
  console.log('\n🔐 Testing Authentication...');
  
  // Test admin login
  const adminLogin = await makeRequest('POST', '/auth/login', TEST_DATA.admin);
  const adminSuccess = adminLogin.success && adminLogin.data.token;
  logTest('Admin Login', adminSuccess, adminLogin.error);
  
  if (adminSuccess) {
    adminToken = adminLogin.data.token;
    
    // Test get current user
    const meResult = await makeRequest('GET', '/me', null, adminToken);
    logTest('Get Current User (/me)', meResult.success && meResult.data.role === 'ADMIN', meResult.error);
  }

  // Test student signup
  const signupResult = await makeRequest('POST', '/auth/signup', TEST_DATA.testUser);
  const signupSuccess = signupResult.success && signupResult.status === 201;
  logTest('Student Signup', signupSuccess, signupResult.error);
  
  if (signupSuccess) {
    createdUserId = signupResult.data.id;
    
    // Test student login
    const studentLogin = await makeRequest('POST', '/auth/login', {
      email: TEST_DATA.testUser.email,
      password: TEST_DATA.testUser.password
    });
    const studentSuccess = studentLogin.success && studentLogin.data.token;
    logTest('Student Login', studentSuccess, studentLogin.error);
    
    if (studentSuccess) {
      studentToken = studentLogin.data.token;
    }
  }

  // Test admin register teacher (if admin login successful)
  if (adminToken) {
    const teacherRegister = await makeRequest('POST', '/auth/register', TEST_DATA.testTeacher, adminToken);
    const teacherSuccess = teacherRegister.success && teacherRegister.status === 201;
    logTest('Admin Register Teacher', teacherSuccess, teacherRegister.error);
    
    if (teacherSuccess) {
      // Test teacher login
      const teacherLogin = await makeRequest('POST', '/auth/login', {
        email: TEST_DATA.testTeacher.email,
        password: TEST_DATA.testTeacher.password
      });
      const teacherLoginSuccess = teacherLogin.success && teacherLogin.data.token;
      logTest('Teacher Login', teacherLoginSuccess, teacherLogin.error);
      
      if (teacherLoginSuccess) {
        teacherToken = teacherLogin.data.token;
      }
    }
  }
};

const testUserManagement = async () => {
  console.log('\n👥 Testing User Management...');
  
  if (!adminToken) {
    logTest('User Management Tests', false, 'Admin token not available');
    return;
  }

  // Test get user profile
  const profileResult = await makeRequest('GET', '/users/profile', null, adminToken);
  logTest('Get User Profile', profileResult.success, profileResult.error, profileResult.fullError);

  // Test update user profile
  const updateProfile = await makeRequest('PUT', '/users/profile', {
    name: 'Admin Updated',
    department: 'Computer Science',
    bio: 'Updated admin profile',
    expertise: ['Node.js', 'PostgreSQL']
  }, adminToken);
  logTest('Update User Profile', updateProfile.success, updateProfile.error);

  // Test get all users (admin only)
  const allUsersResult = await makeRequest('GET', '/users?page=1&limit=10', null, adminToken);
  logTest('Get All Users (Admin)', allUsersResult.success && Array.isArray(allUsersResult.data.data), allUsersResult.error);

  // Test get user by ID
  if (createdUserId) {
    const userByIdResult = await makeRequest('GET', `/users/${createdUserId}`, null, adminToken);
    logTest('Get User by ID', userByIdResult.success, userByIdResult.error);

    // Test update user role
    const roleUpdateResult = await makeRequest('PATCH', `/users/${createdUserId}/role`, {
      role: 'STUDENT'
    }, adminToken);
    logTest('Update User Role', roleUpdateResult.success, roleUpdateResult.error);
  }
};

const testSessions = async () => {
  console.log('\n📅 Testing Sessions...');
  
  // Test get active session (public)
  const activeSessionResult = await makeRequest('GET', '/sessions/active');
  logTest('Get Active Session', activeSessionResult.success, activeSessionResult.error);

  // Test create new session (admin only)
  if (adminToken) {
    const createSessionResult = await makeRequest('POST', '/sessions', {
      name: 'Test Session Fall 2025',
      isActive: false
    }, adminToken);
    logTest('Create New Session', createSessionResult.success, createSessionResult.error);
  }
};

const testProposals = async () => {
  console.log('\n📋 Testing Proposals...');
  
  if (!studentToken || !teacherToken) {
    logTest('Proposal Tests', false, 'Student or teacher token not available');
    return;
  }

  // Test get proposals (student view)
  const studentProposalsResult = await makeRequest('GET', '/proposals', null, studentToken);
  logTest('Get Proposals (Student)', studentProposalsResult.success, studentProposalsResult.error);

  // Test submit new proposal (need teacher ID first)
  if (teacherToken && adminToken) {
    // Get teacher ID from users list
    const usersResult = await makeRequest('GET', '/users?role=TEACHER', null, adminToken);
    if (usersResult.success && usersResult.data.data.length > 0) {
      const teacherId = usersResult.data.data[0].id;
      
      const submitProposalResult = await makeRequest('POST', '/proposals', {
        title: 'Test AI Research Proposal',
        abstract: 'This is a test proposal for AI research focusing on machine learning algorithms and their applications in real-world scenarios.',
        supervisorId: teacherId,
        documentUrl: '/uploads/documents/test-proposal.pdf'
      }, studentToken);
      
      const proposalSuccess = submitProposalResult.success && submitProposalResult.status === 201;
      logTest('Submit New Proposal', proposalSuccess, submitProposalResult.error);
      
      if (proposalSuccess) {
        createdProposalId = submitProposalResult.data.id;
        
        // Test update proposal status (teacher)
        const statusUpdateResult = await makeRequest('PATCH', `/proposals/${createdProposalId}/status`, {
          status: 'APPROVED'
        }, teacherToken);
        logTest('Update Proposal Status', statusUpdateResult.success, statusUpdateResult.error);
        
        // Test assign supervisor (admin)
        const assignResult = await makeRequest('PATCH', `/proposals/${createdProposalId}/assign`, {
          supervisorId: teacherId
        }, adminToken);
        logTest('Assign Supervisor', assignResult.success, assignResult.error);
      }
    }
  }

  // Test get proposals (teacher view)
  const teacherProposalsResult = await makeRequest('GET', '/proposals', null, teacherToken);
  logTest('Get Proposals (Teacher)', teacherProposalsResult.success, teacherProposalsResult.error);

  // Test get proposals (admin view)
  if (adminToken) {
    const adminProposalsResult = await makeRequest('GET', '/proposals', null, adminToken);
    logTest('Get Proposals (Admin)', adminProposalsResult.success, adminProposalsResult.error);
  }
};

const testComments = async () => {
  console.log('\n💬 Testing Comments...');
  
  if (!createdProposalId || !teacherToken) {
    logTest('Comment Tests', false, 'Proposal ID or teacher token not available');
    return;
  }

  // Test add comment to proposal
  const commentResult = await makeRequest('POST', '/comments', {
    proposalId: createdProposalId,
    content: 'This is a test comment. The methodology section looks good but needs more detail on data collection.'
  }, teacherToken);
  logTest('Add Comment to Proposal', commentResult.success, commentResult.error);
};

const testProjectBooks = async () => {
  console.log('\n📚 Testing Project Books...');
  
  if (!createdProposalId || !studentToken || !teacherToken) {
    logTest('Project Book Tests', false, 'Required data not available');
    return;
  }

  // Test submit project book
  const submitBookResult = await makeRequest('POST', '/project-books', {
    proposalId: createdProposalId,
    documentUrl: '/uploads/documents/test-project-book.pdf',
    presentationUrl: '/uploads/documents/test-presentation.pdf',
    sourceCodeUrl: 'https://github.com/test/project'
  }, studentToken);
  
  const bookSuccess = submitBookResult.success && submitBookResult.status === 201;
  logTest('Submit Project Book', bookSuccess, submitBookResult.error);
  
  if (bookSuccess) {
    createdProjectBookId = submitBookResult.data.id;
    
    // Test get all project books
    const allBooksResult = await makeRequest('GET', '/project-books', null, studentToken);
    logTest('Get All Project Books', allBooksResult.success, allBooksResult.error);
    
    // Test get project book by ID
    const bookByIdResult = await makeRequest('GET', `/project-books/${createdProjectBookId}`, null, studentToken);
    logTest('Get Project Book by ID', bookByIdResult.success, bookByIdResult.error);
    
    // Test review project book
    const reviewResult = await makeRequest('PATCH', `/project-books/${createdProjectBookId}/review`, {
      status: 'APPROVED',
      reviewScore: 85,
      reviewComments: 'Excellent work with comprehensive documentation.'
    }, teacherToken);
    logTest('Review Project Book', reviewResult.success, reviewResult.error);
  }
};

const testNotifications = async () => {
  console.log('\n🔔 Testing Notifications...');
  
  if (!studentToken) {
    logTest('Notification Tests', false, 'Student token not available');
    return;
  }

  // Test get user notifications
  const notificationsResult = await makeRequest('GET', '/notifications?page=1&limit=10', null, studentToken);
  logTest('Get User Notifications', notificationsResult.success, notificationsResult.error);

  // Test mark all notifications as read
  const markAllReadResult = await makeRequest('PATCH', '/notifications/mark-all-read', null, studentToken);
  logTest('Mark All Notifications as Read', markAllReadResult.success, markAllReadResult.error);
};

const testAnalytics = async () => {
  console.log('\n📊 Testing Analytics...');
  
  // Test dashboard data (student)
  if (studentToken) {
    const studentDashboardResult = await makeRequest('GET', '/analytics/dashboard', null, studentToken);
    logTest('Get Dashboard Data (Student)', studentDashboardResult.success, studentDashboardResult.error);
  }

  // Test dashboard data (teacher)
  if (teacherToken) {
    const teacherDashboardResult = await makeRequest('GET', '/analytics/dashboard', null, teacherToken);
    logTest('Get Dashboard Data (Teacher)', teacherDashboardResult.success, teacherDashboardResult.error);
  }

  // Test dashboard data (admin)
  if (adminToken) {
    const adminDashboardResult = await makeRequest('GET', '/analytics/dashboard', null, adminToken);
    logTest('Get Dashboard Data (Admin)', adminDashboardResult.success, adminDashboardResult.error);
    
    // Test proposal analytics
    const proposalAnalyticsResult = await makeRequest('GET', '/analytics/proposals', null, adminToken);
    logTest('Get Proposal Analytics', proposalAnalyticsResult.success, proposalAnalyticsResult.error);
    
    // Test user analytics
    const userAnalyticsResult = await makeRequest('GET', '/analytics/users', null, adminToken);
    logTest('Get User Analytics', userAnalyticsResult.success, userAnalyticsResult.error);
  }
};

const testFileUploads = async () => {
  console.log('\n📁 Testing File Upload Endpoints...');
  
  if (!studentToken) {
    logTest('File Upload Tests', false, 'Student token not available');
    return;
  }
  
  // Test endpoints without actual file uploads - should return 400 for missing files
  const docUploadResult = await makeRequest('POST', '/upload/document', null, studentToken);
  logTest('Document Upload Endpoint Accessible', 
    docUploadResult.status === 400 || docUploadResult.error?.includes('No file uploaded'), 
    docUploadResult.error
  );
  
  const imageUploadResult = await makeRequest('POST', '/upload/image', null, studentToken);
  logTest('Image Upload Endpoint Accessible', 
    imageUploadResult.status === 400 || imageUploadResult.error?.includes('No file uploaded'),
    imageUploadResult.error
  );
  
  const profileUploadResult = await makeRequest('POST', '/upload/profile', null, studentToken);
  logTest('Profile Upload Endpoint Accessible', 
    profileUploadResult.status === 400 || profileUploadResult.error?.includes('No file uploaded'),
    profileUploadResult.error
  );
};

// Error handling tests
const testErrorHandling = async () => {
  console.log('\n⚠️  Testing Error Handling...');
  
  // Test unauthorized access
  const unauthorizedResult = await makeRequest('GET', '/users/profile');
  logTest('Unauthorized Access (401)', unauthorizedResult.status === 401, 'Should return 401 for unauthorized access');
  
  // Test invalid token
  const invalidTokenResult = await makeRequest('GET', '/users/profile', null, 'invalid-token');
  logTest('Invalid Token (401)', invalidTokenResult.status === 401, 'Should return 401 for invalid token');
  
  // Test forbidden access (student trying admin endpoint)
  if (studentToken) {
    const forbiddenResult = await makeRequest('GET', '/users', null, studentToken);
    logTest('Forbidden Access (403)', forbiddenResult.status === 403, 'Should return 403 for forbidden access');
  }
  
  // Test not found
  const notFoundResult = await makeRequest('GET', '/nonexistent-endpoint');
  logTest('Not Found (404)', notFoundResult.status === 404, 'Should return 404 for non-existent endpoint');
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting ThesisTrack API Tests...\n');
  console.log(`Testing API at: ${BASE_URL}`);
  
  try {
    // Run tests in sequence
    await testHealthCheck();
    await testAuthentication();
    await testUserManagement();
    await testSessions();
    await testProposals();
    await testComments();
    await testProjectBooks();
    await testNotifications();
    await testAnalytics();
    await testFileUploads();
    await testErrorHandling();
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.passed + testResults.failed}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.error}`);
      });
    }
    
    console.log('\n✨ Test run completed!');
    
    // Save detailed results to file
    const fs = require('fs');
    fs.writeFileSync('api-test-results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        passed: testResults.passed,
        failed: testResults.failed,
        total: testResults.passed + testResults.failed,
        successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)
      },
      details: testResults.details,
      errors: testResults.errors
    }, null, 2));
    
    console.log('📁 Detailed results saved to api-test-results.json');
    
  } catch (error) {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  }
};

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Tests interrupted by user');
  console.log(`📊 Partial results: ${testResults.passed} passed, ${testResults.failed} failed`);
  process.exit(0);
});

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests, makeRequest, testResults };