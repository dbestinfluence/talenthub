import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.items.findMany({
      orderBy: { id: 'asc' }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    )
  }
}
export async function POST() {
  try {
    const item = await prisma.items.create({
      data: {
        name: '',
        qty: 0,
        status: '',
        price: 0
      }
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Failed to create a new row' },
      { status: 500 }
    )
  }
}
