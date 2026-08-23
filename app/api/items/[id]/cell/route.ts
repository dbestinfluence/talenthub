import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIELDS = ['name', 'qty', 'status', 'price'] as const
type AllowedField = (typeof ALLOWED_FIELDS)[number]

type PatchBody = {
  field: AllowedField
  value: string | number
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params
    const id = Number(idParam)

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { error: 'ID tidak valid' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as PatchBody
    const { field, value } = body

    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: 'Field tidak diizinkan' },
        { status: 400 }
      )
    }

    let parsedValue: string | number = value

    if (field === 'qty') {
      const num = Number(value)
      if (Number.isNaN(num)) {
        return NextResponse.json(
          { error: 'qty harus angka' },
          { status: 400 }
        )
      }
      parsedValue = num
    }

    if (field === 'price') {
      const num = Number(value)
      if (Number.isNaN(num)) {
        return NextResponse.json(
          { error: 'price harus angka' },
          { status: 400 }
        )
      }
      parsedValue = num
    }

    const item = await prisma.items.update({
      where: { id },
      data: {
        [field]: parsedValue,
        updated_at: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      item
    })
  } catch (error) {
    console.error('PATCH /api/items/[id]/cell error:', error)

    return NextResponse.json(
      { error: 'Failed to update data' },
      { status: 500 }
    )
  }
}
