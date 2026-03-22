import { Share } from 'lucide-react'
import { useState } from 'react'
import type { ScheduleDayGroup, ScheduleStatus } from '#/lib/types'

export function PdfExportButton({
  weekLabel,
  weekStatus: _weekStatus,
  dayGroups,
  variant = 'default',
}: {
  weekLabel: string
  weekStatus: ScheduleStatus | null
  dayGroups: ScheduleDayGroup[]
  variant?: 'default' | 'fab'
}) {
  const [busy, setBusy] = useState(false)

  async function exportPdf() {
    if (!dayGroups.some((group) => group.rows.length > 0)) {
      return
    }

    setBusy(true)

    try {
      const pdfLib = await import('@react-pdf/renderer')
      const { Document, Page, Text, View, StyleSheet, pdf } = pdfLib

      const dayColorByWeekday: Record<string, string> = {
        monday: '#e9d8c2',
        tuesday: '#cbcbcd',
        wednesday: '#c3d3e3',
        thursday: '#e3c3c6',
        friday: '#cfddc9',
        saturday: '#e8dfbe',
        sunday: '#c8c3d8',
      }

      const getDayFill = (label: string) => {
        const weekday = label.split(',')[0]?.trim().toLowerCase()
        return weekday && dayColorByWeekday[weekday]
          ? dayColorByWeekday[weekday]
          : '#efe5d5'
      }

      const styles = StyleSheet.create({
        page: {
          paddingHorizontal: 36,
          paddingVertical: 28,
          fontSize: 12,
          fontFamily: 'Helvetica',
          backgroundColor: '#e5e5e5',
          color: '#111111',
        },
        title: {
          fontSize: 28,
          marginBottom: 6,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
        },
        weekLabel: {
          marginBottom: 14,
          textAlign: 'center',
          color: '#555555',
          fontSize: 10,
        },
        table: {
          borderWidth: 1,
          borderColor: '#2e2e2e',
          backgroundColor: '#f6f6f6',
        },
        header: {
          flexDirection: 'row',
          backgroundColor: '#ececec',
          borderBottomWidth: 1,
          borderBottomColor: '#2e2e2e',
        },
        headerCell: {
          paddingVertical: 8,
          paddingHorizontal: 8,
          fontFamily: 'Helvetica-Bold',
          fontSize: 11,
          textAlign: 'center',
        },
        headerDayCell: {
          width: '33%',
          borderRightWidth: 1,
          borderRightColor: '#2e2e2e',
        },
        headerApartmentCell: {
          width: '33.5%',
          borderRightWidth: 1,
          borderRightColor: '#2e2e2e',
        },
        headerCleanerCell: {
          width: '33.5%',
        },
        dayBlock: {
          flexDirection: 'row',
        },
        dayBlockDivider: {
          borderBottomWidth: 1,
          borderBottomColor: '#2e2e2e',
        },
        dayCell: {
          width: '33%',
          paddingHorizontal: 8,
          paddingVertical: 10,
          borderRightWidth: 1,
          borderRightColor: '#2e2e2e',
          justifyContent: 'center',
        },
        dayText: {
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          fontSize: 12,
        },
        assignments: {
          width: '67%',
        },
        assignmentRow: {
          flexDirection: 'row',
        },
        assignmentRowBorder: {
          borderBottomWidth: 1,
          borderBottomColor: '#2e2e2e',
        },
        apartmentCell: {
          width: '50%',
          paddingHorizontal: 8,
          paddingVertical: 10,
          borderRightWidth: 1,
          borderRightColor: '#2e2e2e',
          textAlign: 'center',
        },
        cleanerCell: {
          width: '50%',
          paddingHorizontal: 8,
          paddingVertical: 10,
          textAlign: 'center',
        },
      })

      const pdfDocument = (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.title}>Cleaning Schedule</Text>
            <Text style={styles.weekLabel}>{weekLabel}</Text>

            <View style={styles.table}>
              <View style={styles.header}>
                <Text style={[styles.headerCell, styles.headerDayCell]}></Text>
                <Text style={[styles.headerCell, styles.headerApartmentCell]}>Apartment</Text>
                <Text style={[styles.headerCell, styles.headerCleanerCell]}>Cleaners</Text>
              </View>

              {dayGroups.map((group, groupIndex) => {
                const fillColor = getDayFill(group.label)
                const rows = group.rows.length === 0
                  ? [{ id: `${group.date}-none`, apartmentName: '-', cleanerName: '-' }]
                  : group.rows

                if (group.rows.length === 0) {
                  // Empty days stay in the same visual structure as scheduled days.
                }

                return (
                  <View
                    key={group.date}
                    style={[
                      styles.dayBlock,
                      groupIndex < dayGroups.length - 1 ? styles.dayBlockDivider : {},
                      { backgroundColor: fillColor },
                    ]}
                  >
                    <View style={[styles.dayCell, { backgroundColor: fillColor }]}>
                      <Text style={styles.dayText}>{group.label}</Text>
                    </View>

                    <View style={[styles.assignments, { backgroundColor: fillColor }]}>
                      {rows.map((row, index) => (
                        <View
                          key={`${group.date}-${row.id}`}
                          style={[
                            styles.assignmentRow,
                            ...(index < rows.length - 1 ? [styles.assignmentRowBorder] : []),
                          ]}
                        >
                          <Text style={styles.apartmentCell}>{row.apartmentName}</Text>
                          <Text style={styles.cleanerCell}>{row.cleanerName ?? '-'}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })}
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(pdfDocument).toBlob()
      const file = new File(
        [blob],
        `cleaning-schedule-${weekLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`,
        {
        type: 'application/pdf',
        },
      )

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${weekLabel}`,
          text: 'Weekly cleaning schedule',
          files: [file],
        })
      } else {
        const url = URL.createObjectURL(blob)
        const link = window.document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      disabled={busy}
      className={variant === 'fab' ? 'floating-action' : 'action-secondary'}
      aria-label="Share this week"
      title="Share this week"
    >
      <Share size={16} className="scale-125" />
      {variant === 'fab' ? null : busy ? 'Preparing...' : 'Share this week'}
    </button>
  )
}
