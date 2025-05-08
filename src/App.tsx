import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Modal, TextInput, Alert, ActivityIndicator, Image } from 'react-native'
import { useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera'
import { Camera } from 'react-native-vision-camera-face-detector'
import { runOnJS } from 'react-native-reanimated'
import { loadTensorflowModel } from 'react-native-fast-tflite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PhotoManipulator } from 'react-native-photo-manipulator'
import { FileSystem } from 'react-native-file-access'

const { width, height } = Dimensions.get('window')

// FaceNet 모델 설정
const INPUT_SIZE = 160 // FaceNet 입력 크기
const DETECTION_THRESHOLD = 0.5 // 얼굴 감지 최소 정확도
const RECOGNITION_THRESHOLD = 0.7 // 얼굴 인식 유사도 임계값

const FaceRecognition = () => {
  const { hasPermission, requestPermission } = useCameraPermission()
  const camera = useRef(null)
  const device = useCameraDevice('front')

  const [model, setModel] = useState(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isProcessingFrame, setIsProcessingFrame] = useState(false)

  const [faceData, setFaceData] = useState(null)
  const [recognizedPerson, setRecognizedPerson] = useState('Unknown')
  const [isRecording, setIsRecording] = useState(false)
  const [capturedFace, setCapturedFace] = useState(null)
  const [savedFaces, setSavedFaces] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [processingStatus, setProcessingStatus] = useState('')

  // 얼굴 감지 옵션
  const faceDetectionOptions = {
    performanceMode: 'fast',
    landmarkMode: 'all',
    classificationMode: 'all',
    minFaceSize: 0.15,
    tracking: true,
  }

  // 모델 로드 및 초기화
  useEffect(() => {
    const initialize = async () => {
      try {
        setProcessingStatus('모델 로딩 중...')

        // TFLite 모델 로드
        const loadedModel = await loadTensorflowModel(require('./assets/model/facenet.tflite'))
        setModel(loadedModel)
        setIsModelLoaded(true)
        console.log('FaceNet 모델 로드 성공')

        // 저장된 얼굴 불러오기
        const loadedFaces = await loadSavedFaces()
        if (loadedFaces && loadedFaces.length > 0) {
          setSavedFaces(loadedFaces)
          console.log(`저장된 얼굴 ${loadedFaces.length}개 로드 완료`)
        }

        setProcessingStatus('')
      } catch (error) {
        console.error('초기화 실패:', error)
        setProcessingStatus('모델 로드 실패')
        Alert.alert('초기화 오류', '얼굴 인식 모델을 로드하는 데 실패했습니다.')
      }
    }

    requestPermission()
    initialize()

    return () => {
      // 리소스 정리
      if (model) {
        console.log('리소스 정리 중...')
      }
    }
  }, [])

  // 저장된 얼굴 불러오기
  const loadSavedFaces = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('savedFaces')
      return jsonValue != null ? JSON.parse(jsonValue) : []
    } catch (error) {
      console.error('저장된 얼굴 로드 오류:', error)
      return []
    }
  }

  // 얼굴 데이터 저장
  const saveFacesToStorage = async (faces) => {
    try {
      const jsonValue = JSON.stringify(faces)
      await AsyncStorage.setItem('savedFaces', jsonValue)
    } catch (error) {
      console.error('얼굴 저장 오류:', error)
      Alert.alert('저장 오류', '얼굴 데이터를 저장하는 데 실패했습니다.')
    }
  }

  // 프레임 처리 함수
  const processFrame = (frame, faces) => {
    if (isProcessingFrame || !isModelLoaded || !model || !isRecording) return

    try {
      // 감지된 얼굴 데이터 가져오기
      if (faces && faces[0]) {
        // 객체를 배열로 변환 (필요한 경우)
        const detectedFaces = Array.isArray(faces) ? faces : Object.values(faces)

        if (detectedFaces.length > 0) {
          // 가장 큰 얼굴 찾기
          const largestFace = detectedFaces.reduce((prev, current) => {
            const prevArea = prev.bounds.width * prev.bounds.height
            const currentArea = current.bounds.width * current.bounds.height
            return prevArea > currentArea ? prev : current
          })

          setFaceData(largestFace)

          // 얼굴 인식 모드가 활성화된 경우에만 처리
          if (isRecording) {
            recognizeFace(largestFace, frame)
          }
        }
      } else {
        setFaceData(null)
        if (isRecording) {
          setRecognizedPerson('얼굴이 감지되지 않음')
        }
      }
    } catch (error) {
      console.error('프레임 처리 오류:', error)
    }
  }

  // 얼굴 전처리 함수
  const preprocessFace = async (frame, face) => {
    try {
      // 1. 얼굴 영역 추출
      const { bounds } = face

      // 2. 얼굴 이미지를 FaceNet 입력 크기로 조정
      const resizedFace = {
        width: INPUT_SIZE,
        height: INPUT_SIZE,
        // 실제 이미지 데이터를 전처리하는 코드가 필요함
        // 카메라 프레임에서 얼굴 영역을 추출하고 리사이즈
      }

      // 3. 픽셀 정규화 (-1, 1 범위로)
      const normalizedData = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3)

      // 여기서 실제로는 프레임에서 얼굴 영역을 추출하고 전처리해야 함
      // 예시 코드에서는 간단한 더미 데이터를 반환
      return {
        width: INPUT_SIZE,
        height: INPUT_SIZE,
        data: normalizedData,
      }
    } catch (error) {
      console.error('얼굴 전처리 오류:', error)
      return null
    }
  }

  // 얼굴 임베딩 추출 함수
  const extractFaceEmbedding = async (processedFace) => {
    if (!model || !processedFace) return null

    try {
      setIsProcessingFrame(true)

      // 모델 입력 형식에 맞게 데이터 준비
      const inputData = {
        input: processedFace.data, // FaceNet 입력 텐서명에 맞게 조정
      }

      // 모델 실행
      // console.log('model::::', JSON.stringify(model))
      const outputs = await model.run([processedFace.data])

      // 출력 가져오기 (모델에 따라 출력 텐서명이 다를 수 있음)
      const embedding = outputs.output || outputs[0]
      // console.log('Extracted face embedding:', embedding)

      return embedding
    } catch (error) {
      console.error('얼굴 임베딩 추출 오류:', error)
      return null
    } finally {
      setIsProcessingFrame(false)
    }
  }

  // 코사인 유사도 계산
  const cosineSimilarity = (a, b) => {
    if (!a || !b || a.length !== b.length) return -1

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  // 얼굴 인식 함수
  const recognizeFace = async (face, frame) => {
    if (isProcessingFrame || !isModelLoaded || !model) return

    setIsProcessingFrame(true)
    setRecognizedPerson('분석 중...')

    try {
      // 얼굴 전처리
      const processedFace = await preprocessFace(frame, face)

      if (!processedFace) {
        setRecognizedPerson('얼굴 처리 실패')
        return
      }

      // 얼굴 임베딩 추출
      const embedding = await extractFaceEmbedding(processedFace)

      if (!embedding) {
        setRecognizedPerson('특징 추출 실패')
        return
      }

      // 저장된 얼굴과 비교
      if (savedFaces.length === 0) {
        setRecognizedPerson('등록된 얼굴 없음')
        return
      }

      let bestMatch = null
      let highestSimilarity = 0

      // 모든 저장된 얼굴과 비교
      for (const savedFace of savedFaces) {
        const similarity = cosineSimilarity(embedding, savedFace.embedding)

        if (similarity > highestSimilarity && similarity > RECOGNITION_THRESHOLD) {
          highestSimilarity = similarity
          bestMatch = savedFace
        }
      }

      if (bestMatch) {
        setRecognizedPerson(`${bestMatch.name} (${(highestSimilarity * 100).toFixed(1)}%)`)
      } else {
        setRecognizedPerson('미등록 사용자')
      }
    } catch (error) {
      console.error('얼굴 인식 오류:', error)
      setRecognizedPerson('인식 오류 발생')
    } finally {
      setIsProcessingFrame(false)
    }
  }

  // 얼굴 캡처
  const captureFace = async () => {
    if (!camera.current || !faceData) {
      Alert.alert('캡처 오류', '얼굴이 감지되지 않거나 카메라가 준비되지 않았습니다.')
      return
    }

    try {
      setProcessingStatus('얼굴 캡처 중...')

      // 사진 촬영
      const photo = await camera.current.takePhoto({
        flash: 'off',
        quality: 90,
      })
      // return console.log('촬영된 사진 경로:', faceData)

      // 촬영된 얼굴 저장
      setCapturedFace({
        path: photo.path,
        bounds: faceData.bounds,
      })

      // 이름 입력 모달 표시
      setModalVisible(true)
      setProcessingStatus('')
    } catch (error) {
      console.error('얼굴 캡처 오류:', error)
      setProcessingStatus('')
      Alert.alert('캡처 오류', '얼굴을 캡처하는데 실패했습니다. 다시 시도해주세요.')
    }
  }

  // 캡처된 얼굴 전처리 (PhotoManipulator 사용)
  const prepareCapturedFace = async (capturedFaceData) => {
    if (!capturedFaceData || !capturedFaceData.path || !capturedFaceData.bounds) {
      throw new Error('캡처된 얼굴 데이터가 유효하지 않습니다.')
    }
    try {
      const { path, bounds } = capturedFaceData
      // const image = 'https://unsplash.com/photos/qw6qQQyYQpo/download?force=true'
      // const cropRegion = { x: 5, y: 30, height: 400, width: 250 }
      const cropRegion = {
        x: Math.floor(bounds.x), // round → floor로 변경
        y: Math.floor(bounds.y),
        height: Math.ceil(bounds.height), // round → ceil로 변경
        width: Math.ceil(bounds.width),
      }
      const targetSize = { height: INPUT_SIZE, width: INPUT_SIZE }
      console.log('path', path)
      const filePath = 'file://' + path
      // return console.log('filePath', filePath)
      // const readPath = await FileSystem.readFile(path)
      // console.log('readPath', readPath)

      const res = await PhotoManipulator.crop(filePath, cropRegion, targetSize).then((path) => {
        console.log(`Result image path: ${path}`)
        return {
          width: INPUT_SIZE,
          height: INPUT_SIZE,
          data: new Float32Array(INPUT_SIZE * INPUT_SIZE * 3),
          path: path,
        }
      })
      // console.log('res:', res?.data?.height)
      console.log('should work res ')
      return res
    } catch (e) {
      console.log('PhotoManipulator Error', e)
    }
  }

  // 새 사용자 등록
  const addNewPerson = async () => {
    if (!capturedFace || !newPersonName.trim() || !model) {
      Alert.alert('입력 오류', '이름을 입력하고 얼굴이 캡처되었는지 확인하세요.')
      return
    }

    setProcessingStatus('사용자 등록 중...')
    setModalVisible(false)

    try {
      // 캡처된 얼굴 전처리 (PhotoManipulator 사용)
      // const processedFace = await prepareCapturedFace(capturedFace)
      let processedFaced
      await prepareCapturedFace(capturedFace).then((processedFace) => {
        console.log('processedFace:', processedFace?.height)
        processedFaced = processedFace
      })

      if (!processedFaced) {
        console.log('processedFace:', processedFaced)
        Alert.alert('처리 오류', '얼굴을 처리할 수 없습니다. 다시 시도해주세요.')
        return
      }

      // 얼굴 임베딩 추출
      const embedding = await extractFaceEmbedding(processedFaced)

      // return console.log('Embedding:', embedding)

      if (!embedding) {
        Alert.alert('처리 오류', '얼굴 특징을 추출할 수 없습니다. 다시 시도해주세요.')
        return
      }

      // 새 사용자 생성
      const newPerson = {
        id: Date.now().toString(),
        name: newPersonName.trim(),
        embedding: embedding,
        imagePath: processedFaced.path, // 저장된 프로세스 된 이미지 경로 사용
        timestamp: new Date().toISOString(),
      }

      // 저장된 얼굴에 추가
      const updatedFaces = [...savedFaces, newPerson]
      setSavedFaces(updatedFaces)

      // 저장소에 저장
      await saveFacesToStorage(updatedFaces)

      // 상태 초기화
      setNewPersonName('')
      setCapturedFace(null)

      Alert.alert('성공', `${newPersonName}님이 성공적으로 등록되었습니다!`)
    } catch (error) {
      console.error('새 사용자 등록 오류:', error)
      Alert.alert('오류', '새 사용자를 등록하는데 실패했습니다. 다시 시도해주세요.')
    } finally {
      setProcessingStatus('')
    }
  }

  // 얼굴 인식 모드 전환
  const toggleRecognition = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      setRecognizedPerson('스캔 중...')
    } else {
      setRecognizedPerson('인식 중지됨')
    }
  }

  // 얼굴 박스 렌더링
  const renderFaceBox = () => {
    if (!faceData) return null

    const { bounds } = faceData
    const boxStyle = {
      position: 'absolute',
      borderWidth: 2,
      borderColor: isRecording ? '#00FF00' : '#FFFFFF',
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }

    return <View style={boxStyle} />
  }

  // 모든 저장된 얼굴 삭제
  const clearAllFaces = async () => {
    Alert.alert('모든 얼굴 삭제', '모든 저장된 얼굴을 삭제하시겠습니까?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('savedFaces')
            setSavedFaces([])
            Alert.alert('성공', '모든 얼굴이 삭제되었습니다.')
          } catch (error) {
            console.error('얼굴 삭제 오류:', error)
            Alert.alert('오류', '저장된 얼굴을 삭제하는데 실패했습니다.')
          }
        },
      },
    ])
  }

  // 프레임 프로세서 함수
  // const frameProcessor = useFrameProcessor(
  //   (frame) => {
  //     'worklet'
  //     if (frame) {
  //       // faceDetectionCallback 대신 직접 처리
  //       const faceDetectionResult = detectFaces(frame, faceDetectionOptions)
  //       runOnJS(processFrame)(frame, faceDetectionResult)
  //     }
  //   },
  //   [isModelLoaded, isProcessingFrame, isRecording, model],
  // )
  const handleFacesDetection = (faces, frame) => {
    if (faces[0]) {
      const pureFaces = JSON.parse(JSON.stringify(faces))
      const newFaces = Object.values(pureFaces)
      processFrame(frame, newFaces)
    }
  }

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.text}>카메라 권한이 필요합니다</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>권한 허용</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.text}>카메라를 찾을 수 없습니다</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={styles.camera}
        device={device}
        isActive={true}
        // frameProcessorFps={5}
        // fps={5}
        faceDetectionCallback={handleFacesDetection}
        photo={true}
      />

      {/* 얼굴 오버레이 */}
      <View style={styles.overlay}>
        {renderFaceBox()}

        {/* 상태 표시 */}
        {processingStatus ? (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.statusText}>{processingStatus}</Text>
          </View>
        ) : null}

        {/* 인식 결과 */}
        <View style={styles.recognitionStatus}>
          <Text style={styles.recognitionText}>{isRecording ? `인식: ${recognizedPerson}` : '인식 비활성화됨'}</Text>
        </View>

        {/* 컨트롤 버튼 */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.button, isRecording ? styles.activeButton : null]} onPress={toggleRecognition}>
            <Text style={styles.buttonText}>{isRecording ? '인식 중지' : '인식 시작'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isRecording ? styles.disabledButton : null]}
            onPress={captureFace}
            disabled={isRecording || !faceData}>
            <Text style={styles.buttonText}>얼굴 등록</Text>
          </TouchableOpacity>
        </View>

        {/* 저장된 얼굴 정보 및 삭제 버튼 */}
        <View style={styles.savedFacesContainer}>
          <View style={styles.savedFacesInfo}>
            <Text style={styles.text}>저장된 얼굴: {savedFaces.length}</Text>
          </View>

          {savedFaces.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearAllFaces}>
              <Text style={styles.buttonText}>모두 삭제</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 사용자 등록 모달 */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새 사용자 등록</Text>

            <TextInput style={styles.input} placeholder="사용자 이름 입력" value={newPersonName} onChangeText={setNewPersonName} />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false)
                  setCapturedFace(null)
                  setNewPersonName('')
                }}>
                <Text style={styles.buttonText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={addNewPerson}>
                <Text style={styles.buttonText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {capturedFace?.path && (
          <Image
            source={{ uri: 'file://' + capturedFace.path }}
            style={{
              width: 100,
              height: 100,
              position: 'absolute',
              top: 50,
              left: 50,
              borderRadius: 10,
            }}
          />
        )}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'red',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 20,
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
  },
  statusText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
  },
  recognitionStatus: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    margin: 20,
    borderRadius: 10,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recognitionText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  button: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#e74c3c',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  savedFacesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 8,
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  savedFacesInfo: {
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 5,
    marginLeft: 10,
  },
  text: {
    color: 'white',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    flex: 1,
    marginRight: 5,
  },
  saveButton: {
    backgroundColor: '#2ecc71',
    flex: 1,
    marginLeft: 5,
  },
})

export function App() {
  return (
    <View style={{ flex: 1 }}>
      <FaceRecognition />
    </View>
  )
}
