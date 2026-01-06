const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create Admin user
    const adminPassword = await bcrypt.hash('Admin@123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@milestone.com' },
        update: {},
        create: {
            email: 'admin@milestone.com',
            password: adminPassword,
            name: 'System Admin',
            role: 'ADMIN',
            department: 'Administration',
            isActive: true
        }
    });
    console.log('✅ Admin user created:', admin.email);

    // Create Manager
    const managerPassword = await bcrypt.hash('Manager@123', 12);
    const manager = await prisma.user.upsert({
        where: { email: 'manager@milestone.com' },
        update: {},
        create: {
            email: 'manager@milestone.com',
            password: managerPassword,
            name: 'Team Manager',
            role: 'MANAGER',
            department: 'Engineering',
            isActive: true
        }
    });
    console.log('✅ Manager user created:', manager.email);

    // Create sample employees
    const employeePassword = await bcrypt.hash('Employee@123', 12);

    const employees = [
        { email: 'john.doe@milestone.com', name: 'John Doe', department: 'Engineering' },
        { email: 'jane.smith@milestone.com', name: 'Jane Smith', department: 'Engineering' },
        { email: 'bob.wilson@milestone.com', name: 'Bob Wilson', department: 'Design' },
        { email: 'alice.johnson@milestone.com', name: 'Alice Johnson', department: 'Design' },
        { email: 'charlie.brown@milestone.com', name: 'Charlie Brown', department: 'Marketing' },
        { email: 'diana.prince@milestone.com', name: 'Diana Prince', department: 'Marketing' },
        { email: 'edward.stark@milestone.com', name: 'Edward Stark', department: 'Engineering' },
        { email: 'fiona.green@milestone.com', name: 'Fiona Green', department: 'Product' },
        { email: 'george.miller@milestone.com', name: 'George Miller', department: 'Product' },
        { email: 'hannah.white@milestone.com', name: 'Hannah White', department: 'Engineering' },
        { email: 'ivan.petrov@milestone.com', name: 'Ivan Petrov', department: 'Engineering' },
        { email: 'julia.chen@milestone.com', name: 'Julia Chen', department: 'Design' },
        { email: 'kevin.lee@milestone.com', name: 'Kevin Lee', department: 'Marketing' }
    ];

    for (const emp of employees) {
        const user = await prisma.user.upsert({
            where: { email: emp.email },
            update: {},
            create: {
                email: emp.email,
                password: employeePassword,
                name: emp.name,
                role: 'EMPLOYEE',
                department: emp.department,
                isActive: true
            }
        });
        console.log(`✅ Employee created: ${user.email}`);
    }

    console.log('\n📊 Database seeded successfully!');
    console.log('\n🔑 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:    admin@milestone.com    / Admin@123');
    console.log('Manager:  manager@milestone.com  / Manager@123');
    console.log('Employee: john.doe@milestone.com / Employee@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('Seed failed:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
