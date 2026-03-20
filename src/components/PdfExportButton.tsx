import { useState } from 'react'
import type { ScheduleDayGroup, ScheduleStatus } from '#/lib/types'

export function PdfExportButton({
  weekLabel,
  weekStatus,
  dayGroups,
}: {
  weekLabel: string
  weekStatus: ScheduleStatus | null
  dayGroups: ScheduleDayGroup[]
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
      const styles = StyleSheet.create({
        page: {
          padding: 32,
          fontSize: 11,
          fontFamily: 'Helvetica',
          backgroundColor: '#fbf7ef',
          color: '#3f3424',
        },
        title: {
          fontSize: 22,
          marginBottom: 4,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
        },
        subtitle: {
          fontSize: 11,
          marginBottom: 16,
          textAlign: 'center',
          color: '#7a6854',
        },
        table: {
          borderWidth: 1,
          borderColor: '#8f7e68',
        },
        header: {
          flexDirection: 'row',
          backgroundColor: '#efe6d6',
          borderBottomWidth: 1,
          borderBottomColor: '#8f7e68',
        },
        row: {
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: '#b9a893',
        },
        dayCell: {
          width: '32%',
          padding: 8,
          borderRightWidth: 1,
          borderRightColor: '#8f7e68',
        },
        apartmentCell: {
          width: '38%',
          padding: 8,
          borderRightWidth: 1,
          borderRightColor: '#8f7e68',
        },
        cleanerCell: {
          width: '30%',
          padding: 8,
        },
        headerText: {
          fontFamily: 'Helvetica-Bold',
        },
      })

      const pdfDocument = (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.title}>Cleaning Schedule</Text>
            <Text style={styles.subtitle}>
              {weekLabel} • {weekStatus ?? 'draft'}
            </Text>

            <View style={styles.table}>
              <View style={styles.header}>
                <Text style={[styles.dayCell, styles.headerText]}>Date</Text>
                <Text style={[styles.apartmentCell, styles.headerText]}>Apartment</Text>
                <Text style={[styles.cleanerCell, styles.headerText]}>Cleaner</Text>
              </View>

              {dayGroups.map((group) => {
                if (group.rows.length === 0) {
                  return (
                    <View key={group.date} style={styles.row}>
                      <Text style={styles.dayCell}>{group.label}</Text>
                      <Text style={styles.apartmentCell}>No cleaning scheduled</Text>
                      <Text style={styles.cleanerCell}>-</Text>
                    </View>
                  )
                }

                return group.rows.map((row, index) => (
                  <View key={`${group.date}-${row.id}`} style={styles.row}>
                    <Text style={styles.dayCell}>{index === 0 ? group.label : ''}</Text>
                    <Text style={styles.apartmentCell}>{row.apartmentName}</Text>
                    <Text style={styles.cleanerCell}>{row.cleanerName ?? '-'}</Text>
                  </View>
                ))
              })}
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(pdfDocument).toBlob()
      const file = new File([blob], `stayclean-${weekLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`, {
        type: 'application/pdf',
      })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `StayClean ${weekLabel}`,
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
    <button type="button" onClick={exportPdf} disabled={busy} className="action-secondary">
      {busy ? 'Preparing PDF...' : 'Export / Share PDF'}
    </button>
  )
}
