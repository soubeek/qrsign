import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import SignaturePad from 'signature_pad'

export function useSignaturePad(canvasRef: Ref<HTMLCanvasElement | null>) {
  const signaturePad = ref<SignaturePad | null>(null)
  const isEmpty = ref(true)
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null

  function resizeCanvas() {
    const canvas = canvasRef.value
    if (!canvas || !signaturePad.value) return

    // Save current signature data before resize
    const data = signaturePad.value.toData()
    const wasEmpty = signaturePad.value.isEmpty()

    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
    }

    signaturePad.value.clear()

    // Restore signature data if there was one
    if (!wasEmpty && data.length > 0) {
      signaturePad.value.fromData(data)
      isEmpty.value = false
    } else {
      isEmpty.value = true
    }
  }

  function debouncedResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(resizeCanvas, 150)
  }

  function setup() {
    const canvas = canvasRef.value
    if (!canvas) return

    signaturePad.value = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 3,
    })

    signaturePad.value.addEventListener('endStroke', () => {
      isEmpty.value = signaturePad.value?.isEmpty() ?? true
    })

    resizeCanvas()
    window.addEventListener('resize', debouncedResize)
    window.addEventListener('orientationchange', debouncedResize)
  }

  function clear() {
    signaturePad.value?.clear()
    isEmpty.value = true
  }

  function toDataURL(type = 'image/png'): string {
    const canvas = canvasRef.value
    if (!canvas || !signaturePad.value) return ''

    // Always export at a fixed max width to keep file size consistent
    const maxWidth = 600
    const ratio = canvas.width / canvas.height
    const exportWidth = Math.min(canvas.width, maxWidth)
    const exportHeight = Math.round(exportWidth / ratio)

    if (canvas.width <= maxWidth) {
      return signaturePad.value.toDataURL(type)
    }

    // Downscale via offscreen canvas
    const offscreen = document.createElement('canvas')
    offscreen.width = exportWidth
    offscreen.height = exportHeight
    const ctx = offscreen.getContext('2d')
    if (!ctx) return signaturePad.value.toDataURL(type)
    ctx.drawImage(canvas, 0, 0, exportWidth, exportHeight)
    return offscreen.toDataURL(type)
  }

  function isBlank(): boolean {
    return signaturePad.value?.isEmpty() ?? true
  }

  onMounted(() => {
    setup()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', debouncedResize)
    window.removeEventListener('orientationchange', debouncedResize)
    if (resizeTimeout) clearTimeout(resizeTimeout)
    signaturePad.value?.off()
  })

  return {
    signaturePad,
    isEmpty,
    clear,
    toDataURL,
    isBlank,
    resizeCanvas,
  }
}
