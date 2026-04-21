export class LaptopImageEntity {
    id: string;
    kind: 'FEATURED' | 'GALLERY';
    url: string;
    publicId: string;
    position: number;
}

export class LaptopEntity {
    id: string;
    title: string;
    slug: string;
    brand: string;
    model: string;
    price: string;
    stock: number;
    shortDescription?: string | null;
    description?: string | null;
    cpu?: string | null;
    ram?: string | null;
    storage?: string | null;
    gpu?: string | null;
    screenSize?: string | null;
    os?: string | null;
    featuredImage: LaptopImageEntity | null;
    galleryImages: LaptopImageEntity[];
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
}
