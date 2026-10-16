-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'EDITOR') NOT NULL DEFAULT 'ADMIN',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `image` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Brand` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Brand_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `shortDescription` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `priceCents` INTEGER NOT NULL,
    `compareAtCents` INTEGER NULL,
    `costCents` INTEGER NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `trackStock` BOOLEAN NOT NULL DEFAULT true,
    `allowBackorder` BOOLEAN NOT NULL DEFAULT false,
    `lowStockAlert` INTEGER NOT NULL DEFAULT 3,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `isNew` BOOLEAN NOT NULL DEFAULT false,
    `freeShipping` BOOLEAN NOT NULL DEFAULT false,
    `voltage` ENUM('V110', 'V220', 'BIVOLT', 'NA') NULL,
    `variantLabel` VARCHAR(191) NULL,
    `warrantyMonths` INTEGER NULL,
    `weightGrams` INTEGER NULL,
    `widthCm` DOUBLE NULL,
    `heightCm` DOUBLE NULL,
    `depthCm` DOUBLE NULL,
    `color` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `ean` VARCHAR(191) NULL,
    `specs` JSON NULL,
    `tags` VARCHAR(500) NULL,
    `videoUrl` VARCHAR(191) NULL,
    `metaTitle` VARCHAR(191) NULL,
    `metaDescription` VARCHAR(320) NULL,
    `soldCount` INTEGER NOT NULL DEFAULT 0,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `ratingAvg` DOUBLE NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,
    `categoryId` VARCHAR(191) NULL,
    `brandId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_status_featured_idx`(`status`, `featured`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_brandId_idx`(`brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `alt` VARCHAR(191) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductImage_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `priceCents` INTEGER NULL,
    `compareAtCents` INTEGER NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductVariant_sku_key`(`sku`),
    INDEX `ProductVariant_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `comment` TEXT NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Review_productId_approved_idx`(`productId`, `approved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banner` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(300) NULL,
    `eyebrow` VARCHAR(191) NULL,
    `ctaLabel` VARCHAR(191) NULL,
    `href` VARCHAR(191) NULL,
    `imageDesktop` VARCHAR(191) NOT NULL,
    `imageMobile` VARCHAR(191) NULL,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'dark',
    `align` VARCHAR(191) NOT NULL DEFAULT 'left',
    `placement` ENUM('HERO', 'STRIP') NOT NULL DEFAULT 'HERO',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Promotion` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `type` ENUM('PERCENT', 'FIXED') NOT NULL,
    `value` INTEGER NOT NULL,
    `scope` ENUM('ALL', 'CATEGORY', 'BRAND', 'PRODUCTS') NOT NULL DEFAULT 'PRODUCTS',
    `categoryIds` JSON NULL,
    `brandIds` JSON NULL,
    `productIds` JSON NULL,
    `flash` BOOLEAN NOT NULL DEFAULT false,
    `badge` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(300) NULL,
    `type` ENUM('PERCENT', 'FIXED', 'FREE_SHIPPING') NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `minSubtotalCents` INTEGER NULL,
    `maxDiscountCents` INTEGER NULL,
    `usageLimit` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `perCustomerLimit` INTEGER NULL,
    `firstOrderOnly` BOOLEAN NOT NULL DEFAULT false,
    `stackWithPromotions` BOOLEAN NOT NULL DEFAULT true,
    `scope` ENUM('ALL', 'CATEGORY', 'BRAND', 'PRODUCTS') NOT NULL DEFAULT 'ALL',
    `categoryIds` JSON NULL,
    `brandIds` JSON NULL,
    `productIds` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Coupon_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NewsletterSubscriber` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `NewsletterSubscriber_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(768) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `userAgent` VARCHAR(400) NULL,
    `failures` INTEGER NOT NULL DEFAULT 0,
    `lastSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PushSubscription_endpoint_key`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `url` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `showInFooter` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(20) NOT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `customerDoc` VARCHAR(20) NULL,
    `deliveryType` ENUM('DELIVERY', 'PICKUP') NOT NULL DEFAULT 'DELIVERY',
    `cep` VARCHAR(9) NULL,
    `street` VARCHAR(191) NULL,
    `number` VARCHAR(20) NULL,
    `complement` VARCHAR(191) NULL,
    `neighborhood` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(2) NULL,
    `reference` VARCHAR(191) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `distanceKm` DOUBLE NULL,
    `subtotalCents` INTEGER NOT NULL,
    `discountCents` INTEGER NOT NULL DEFAULT 0,
    `pixDiscountCents` INTEGER NOT NULL DEFAULT 0,
    `shippingCents` INTEGER NOT NULL DEFAULT 0,
    `totalCents` INTEGER NOT NULL,
    `couponCode` VARCHAR(191) NULL,
    `couponId` VARCHAR(191) NULL,
    `paymentMethod` ENUM('ONLINE_STRIPE', 'PIX_MANUAL', 'PIX_ON_DELIVERY', 'CARD_ON_DELIVERY', 'CASH_ON_DELIVERY') NOT NULL,
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `changeForCents` INTEGER NULL,
    `stripeSessionId` VARCHAR(191) NULL,
    `stripePaymentIntentId` VARCHAR(191) NULL,
    `status` ENUM('NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELED') NOT NULL DEFAULT 'NEW',
    `notes` TEXT NULL,
    `adminNotes` TEXT NULL,
    `whatsappMessage` TEXT NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_code_key`(`code`),
    UNIQUE INDEX `Order_stripeSessionId_key`(`stripeSessionId`),
    INDEX `Order_status_idx`(`status`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    INDEX `Order_customerPhone_idx`(`customerPhone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `variantName` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `unitPriceCents` INTEGER NOT NULL,
    `originalUnitPriceCents` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `totalCents` INTEGER NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderEvent_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeoCache` (
    `key` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `meters` DOUBLE NULL,
    `label` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
