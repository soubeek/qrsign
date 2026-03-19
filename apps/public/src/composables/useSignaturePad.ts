import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import SignaturePad from 'signature_pad'

export function useSignaturePad(canvasRef: Ref<HTMLCanvasElement | null>) {
  const signaturePad = ref<SignaturePad | null>(null)
  const isEmpty = ref(true)

  function resizeCanvas() {
    const canvas = canvasRef.value
    if (!canvas || !signaturePad.value) return

    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
    }
    signaturePad.value.clear()
    isEmpty.value = true
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
    window.addEventListener('resize', resizeCanvas)
  }

  function clear() {
    signaturePad.value?.clear()
    isEmpty.value = true
  }

  function toDataURL(type = 'image/png'): string {
    return signaturePad.value?.toDataURL(type) ?? ''
  }

  function isBlank(): boolean {
    return signaturePad.value?.isEmpty() ?? true
  }

  onMounted(() => {
    setup()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resizeCanvas)
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
