import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean up
  await prisma.reservation.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const [delhi, mumbai, bangalore] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Delhi Hub", location: "New Delhi, IN" },
    }),
    prisma.warehouse.create({
      data: { name: "Mumbai Hub", location: "Mumbai, IN" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore Hub", location: "Bangalore, IN" },
    }),
  ]);

  // Products
  const [laptop, headphones, keyboard, monitor, mouse] = await Promise.all([
    prisma.product.create({
      data: {
        name: "UltraBook Pro 14",
        description: "Lightweight laptop with 14-inch Retina display, 16GB RAM, 512GB SSD",
        imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "SoundMax ANC Headphones",
        description: "Active noise-cancelling over-ear headphones with 30hr battery life",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "MechKey Pro Keyboard",
        description: "Tenkeyless mechanical keyboard with Cherry MX switches",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "4K UltraWide Monitor",
        description: "34-inch curved 4K UltraWide monitor with HDR support",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "ErgoMouse Wireless",
        description: "Ergonomic vertical wireless mouse with 6-month battery life",
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400",
      },
    }),
  ]);

  // Stock levels
  const stockData = [
    // Laptop
    { productId: laptop.id, warehouseId: delhi.id, total: 10, reserved: 0 },
    { productId: laptop.id, warehouseId: mumbai.id, total: 5, reserved: 0 },
    { productId: laptop.id, warehouseId: bangalore.id, total: 2, reserved: 0 },
    // Headphones
    { productId: headphones.id, warehouseId: delhi.id, total: 25, reserved: 0 },
    { productId: headphones.id, warehouseId: mumbai.id, total: 15, reserved: 0 },
    // Keyboard
    { productId: keyboard.id, warehouseId: delhi.id, total: 3, reserved: 0 },
    { productId: keyboard.id, warehouseId: bangalore.id, total: 8, reserved: 0 },
    // Monitor
    { productId: monitor.id, warehouseId: mumbai.id, total: 1, reserved: 0 },
    { productId: monitor.id, warehouseId: bangalore.id, total: 4, reserved: 0 },
    // Mouse
    { productId: mouse.id, warehouseId: delhi.id, total: 50, reserved: 0 },
    { productId: mouse.id, warehouseId: mumbai.id, total: 30, reserved: 0 },
    { productId: mouse.id, warehouseId: bangalore.id, total: 20, reserved: 0 },
  ];

  await prisma.stock.createMany({ data: stockData });

  console.log("✅ Seed complete:");
  console.log(`   • ${3} warehouses`);
  console.log(`   • ${5} products`);
  console.log(`   • ${stockData.length} stock entries`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
