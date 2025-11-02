document.addEventListener('DOMContentLoaded', function() {
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const stepText = document.getElementById('stepText');

    const employeeSection = document.getElementById('employeeSection');
    const passwordSection = document.getElementById('passwordSection');
    const employeeInput = document.getElementById('employee_number');
    const passwordInput = document.getElementById('password');

    const steps = document.querySelectorAll('.step');
    const stepLines = document.querySelectorAll('.step-line');

    let currentStep = 1;

    // دالة لإضافة رقم
    function addNumber(value) {
        if (currentStep === 1) {
            if (employeeInput.value.length < 10) {
                employeeInput.value += value;
                // التحقق من رقم الموظف عند إدخال 4 أرقام أو أكثر
                if (employeeInput.value.length >= 4) {
                    checkEmployeeNumber(employeeInput.value);
                }
            }
        } else {
            if (passwordInput.value.length < 20) {
                passwordInput.value += value;
            }
        }
    }

    // دالة لمسح الإدخال
    function clearInput() {
        if (currentStep === 1) {
            employeeInput.value = '';
        } else {
            passwordInput.value = '';
        }
    }

    // إعداد لوحة الأرقام
    document.querySelectorAll('.number-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const value = this.getAttribute('data-value');

            if (value === 'clear') {
                clearInput();
            } else if (value === 'next') {
                if (employeeInput.value.trim() !== '') {
                    nextStep();
                }
            } else if (value === 'login') {
                if (passwordInput.value.trim() !== '') {
                    login();
                }
            } else {
                addNumber(value);
            }
        });
    });

    // إضافة دعم لوحة المفاتيح
    document.addEventListener('keydown', function(event) {
        const key = event.key;

        // التحقق من أن الإدخال رقمي
        if (/^[0-9]$/.test(key)) {
            event.preventDefault();
            addNumber(key);
        }
        // مفتاح Backspace للمسح
        else if (key === 'Backspace') {
            event.preventDefault();
            if (currentStep === 1) {
                employeeInput.value = employeeInput.value.slice(0, -1);
            } else {
                passwordInput.value = passwordInput.value.slice(0, -1);
            }
        }
        // مفتاح Enter للانتقال أو تسجيل الدخول
        else if (key === 'Enter') {
            event.preventDefault();
            if (currentStep === 1 && employeeInput.value.trim() !== '') {
                nextStep();
            } else if (currentStep === 2 && passwordInput.value.trim() !== '') {
                login();
            }
        }
        // مفتاح Escape للعودة
        else if (key === 'Escape' && currentStep === 2) {
            event.preventDefault();
            previousStep();
        }
    });

    // زر العودة
    document.getElementById('btnBack').addEventListener('click', function() {
        previousStep();
    });

    function nextStep() {
        currentStep = 2;
        // إضافة تأثير انتقال سحب
        employeeSection.classList.add('leaving');
        setTimeout(() => {
            employeeSection.classList.remove('active', 'leaving');
            passwordSection.classList.add('active');
            updateUI();
        }, 300);
    }

    function previousStep() {
        currentStep = 1;
        passwordInput.value = '';
        employeeInput.value = ''; // مسح حقل رقم الموظف عند العودة
        // إضافة تأثير انتقال سحب عكسي
        passwordSection.classList.add('leaving');
        setTimeout(() => {
            passwordSection.classList.remove('active', 'leaving');
            employeeSection.classList.add('active');
            updateUI();
        }, 300);
    }

    function updateUI() {
        // تحديث المؤشرات
        steps.forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            step.classList.remove('active', 'completed');
            if (stepNum === currentStep) {
                step.classList.add('active');
            } else if (stepNum < currentStep) {
                step.classList.add('completed');
            }
        });

        stepLines.forEach(line => {
            line.classList.toggle('active', currentStep > 1);
        });

        // تحديث النص
        stepText.textContent = currentStep === 1 ? 'أدخل رقم الموظف' : 'أدخل كلمة المرور';

        // تحديث الأقسام
        employeeSection.classList.toggle('active', currentStep === 1);
        passwordSection.classList.toggle('active', currentStep === 2);

        // إخفاء الرسائل
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    async function login() {
        const employee_number = employeeInput.value;
        const password = passwordInput.value;

        // إزالة أي تنبيه خطأ سابق
        document.querySelector('.number-pad').classList.remove('error');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ employee_number, password }),
            });

            const data = await response.json();

            if (data.success) {
                successMessage.textContent = 'تم تسجيل الدخول بنجاح!';
                successMessage.style.display = 'block';
                errorMessage.style.display = 'none';

                // حفظ التوكن في localStorage للأجهزة المحمولة
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                }

                // إعادة توجيه بعد ثانيتين
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 2000);
            } else {
                // إضافة تنبيه أحمر مع اهتزاز للوحة الأرقام
                document.querySelector('.number-pad').classList.add('error');

                // العودة للخطوة الأولى مباشرة
                previousStep();

                // إزالة التنبيه الأحمر بعد 3 ثوانٍ
                setTimeout(() => {
                    document.querySelector('.number-pad').classList.remove('error');
                }, 3000);
            }
        } catch (error) {
            // إضافة تنبيه أحمر للوحة الأرقام في حالة خطأ الاتصال
            document.querySelector('.number-pad').classList.add('error');
        }
    }

    // دالة التحقق من رقم الموظف
    async function checkEmployeeNumber(employeeNumber) {
        try {
            const response = await fetch('/api/auth/check-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ employee_number: employeeNumber }),
            });

            const data = await response.json();

            if (!data.success) {
                // إضافة تنبيه أحمر مع اهتزاز للوحة الأرقام
                document.querySelector('.number-pad').classList.add('error');

                // العودة للخطوة الأولى مباشرة
                previousStep();

                // إزالة التنبيه الأحمر بعد 3 ثوانٍ
                setTimeout(() => {
                    document.querySelector('.number-pad').classList.remove('error');
                }, 3000);
            } else {
                // إزالة أي تنبيه خطأ سابق إذا كان الرقم صحيح
                document.querySelector('.number-pad').classList.remove('error');
            }
        } catch (error) {
            console.error('خطأ في التحقق من رقم الموظف:', error);
        }
    }

    // بدء مع الخطوة الأولى
    updateUI();
});
