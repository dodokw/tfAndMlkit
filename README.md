Face Recognition App - README(todoList포함)
개요
이 프로젝트는 React Native 기반의 실시간 얼굴 인식 앱입니다.
카메라로 얼굴을 감지하고, 감지된 얼굴을 촬영해 등록 및 인식할 수 있습니다.
FaceNet 모델(facenet.tflite)을 사용하여 얼굴 임베딩을 추출하고, 저장된 얼굴과 코사인 유사도로 비교합니다.

주요 기능
실시간 얼굴 감지 (react-native-vision-camera-face-detector)

FaceNet 임베딩 추출 (react-native-fast-tflite)

얼굴 등록 및 인식

얼굴 이미지 크롭/리사이즈 및 전처리 (react-native-photo-manipulator)

AsyncStorage를 통한 얼굴 데이터 저장/로드

얼굴 이미지 전처리 및 임베딩 추출 과정

1. 얼굴 영역 크롭 및 리사이즈
   얼굴 감지 후, 감지된 얼굴의 경계(bounds)를 기준으로 이미지를 크롭합니다.

크롭된 이미지를 FaceNet 입력 크기(160x160)로 리사이즈합니다.

이 과정은 PhotoManipulator.crop을 사용합니다.

js
const cropRegion = {
x: Math.floor(bounds.x),
y: Math.floor(bounds.y),
width: Math.ceil(bounds.width),
height: Math.ceil(bounds.height),
}
const targetSize = { width: INPUT_SIZE, height: INPUT_SIZE }
const filePath = path.startsWith('file://') ? path : 'file://' + path

// 크롭 및 리사이즈
const croppedPath = await PhotoManipulator.crop(filePath, cropRegion, targetSize) 2. 크롭된 이미지 base64 또는 바이너리로 읽기
크롭된 이미지 파일을 base64로 읽어옵니다.

react-native-file-access의 FileSystem.readFile을 사용합니다.

js
const base64Data = await FileSystem.readFile(croppedPath, 'base64') 3. 이미지 데이터를 모델 입력에 맞게 변환 (정규화 등)
base64 데이터를 바이너리로 변환한 뒤, JPEG 디코더(jpeg-js 등)로 픽셀 데이터를 추출합니다.

RGB 채널만 추출하고, 픽셀 값을 -1~1 범위로 정규화합니다.

js
import jpeg from 'jpeg-js'

const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
const decoded = jpeg.decode(binaryData, { useTArray: true })

const float32Data = new Float32Array(INPUT*SIZE * INPUT*SIZE * 3)
for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 3) {
float32Data[j] = decoded.data[i] / 127.5 - 1 // R
float32Data[j+1] = decoded.data[i+1] / 127.5 - 1 // G
float32Data[j+2] = decoded.data[i+2] / 127.5 - 1 // B
} 4. 변환된 데이터를 Float32Array로 반환
최종적으로 { width, height, data: Float32Array, path } 형태의 객체를 반환합니다.

js
return {
width: INPUT_SIZE,
height: INPUT_SIZE,
data: float32Data,
path: croppedPath,
}
전체 전처리 함수 예시
js
const prepareCapturedFace = async (capturedFaceData) => {
if (!capturedFaceData || !capturedFaceData.path || !capturedFaceData.bounds) {
throw new Error('캡처된 얼굴 데이터가 유효하지 않습니다.')
}
const { path, bounds } = capturedFaceData
const cropRegion = {
x: Math.floor(bounds.x),
y: Math.floor(bounds.y),
width: Math.ceil(bounds.width),
height: Math.ceil(bounds.height),
}
const targetSize = { width: INPUT_SIZE, height: INPUT_SIZE }
const filePath = path.startsWith('file://') ? path : 'file://' + path

// 1. 크롭 및 리사이즈
const croppedPath = await PhotoManipulator.crop(filePath, cropRegion, targetSize)

// 2. base64로 읽기
const base64Data = await FileSystem.readFile(croppedPath, 'base64')

// 3. JPEG 디코딩 및 정규화 (jpeg-js 필요)
const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
const decoded = jpeg.decode(binaryData, { useTArray: true })

const float32Data = new Float32Array(INPUT*SIZE * INPUT*SIZE * 3)
for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 3) {
float32Data[j] = decoded.data[i] / 127.5 - 1
float32Data[j+1] = decoded.data[i+1] / 127.5 - 1
float32Data[j+2] = decoded.data[i+2] / 127.5 - 1
}

return {
width: INPUT_SIZE,
height: INPUT_SIZE,
data: float32Data,
path: croppedPath,
}
}
구현 난이도 및 주의사항
이미지 디코딩: React Native에서는 base64 → 바이너리 → 픽셀(RGB) 추출이 쉽지 않습니다.
jpeg-js 같은 라이브러리를 사용해야 하며, 네이티브/JS 브릿지 성능에 주의해야 합니다.

성능: JS에서 대용량 이미지 처리 시 느려질 수 있습니다.
실제 서비스에서는 네이티브 모듈이나 WebAssembly로 최적화하는 것이 좋습니다.

파일 경로: 플랫폼별(file:// 접두어 등) 경로 처리에 유의해야 합니다.

정규화: FaceNet 등 모델은 입력값을 -1~1로 정규화해야 정확히 동작합니다.

의존성
react-native-photo-manipulator

react-native-file-access

jpeg-js (JS에서 JPEG 디코딩용)

react-native-fast-tflite

결론
이 프로젝트는 실시간 얼굴 감지, 등록, 인식까지의 전체 파이프라인을 제공합니다.
이미지 전처리(크롭, 리사이즈, 정규화)와 임베딩 추출을 정확히 구현해야 높은 인식률을 얻을 수 있습니다.
실제 서비스에서는 네이티브 최적화 또는 WebAssembly 도입을 권장합니다.
