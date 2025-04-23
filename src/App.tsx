// App.js
import React, { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { Camera, useCameraDevices } from 'react-native-vision-camera'
import { useFaceDetector } from 'react-native-vision-camera-face-detector'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as tf from '@tensorflow/tfjs'
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native'
import { Asset } from 'expo-asset'

// GhostFaceNets 모델 경로 (가정: 앱 내에 포함된 모델 파일).
const MODEL_JSON = require('./assets/model/model.json')
const MODEL_WEIGHTS = require('./assets/model/weights.bin')

// 임베딩 유사도 비교 함수
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

// 이미지 전처리 함수
const preprocessImage = async (image) => {
  // 이미지를 텐서로 변환
  const imageAsset = Asset.fromURI(image.uri)
  await imageAsset.downloadAsync()

  const imageBuffer = await require('fs').readFileSync(imageAsset.localUri)
  const imageTensor = decodeJpeg(imageBuffer)

  // 크기 조정 (GhostFaceNets 입력 크기에 맞게)
  const resized = tf.image.resizeBilinear(imageTensor, [112, 112])

  // 정규화 (0~1 범위로)
  const normalized = resized.div(255.0)

  // 배치 차원 추가
  const batched = normalized.expandDims(0)

  return batched
}

const App = () => {
  const [hasPermission, setHasPermission] = useState(null)
  const [registrationMode, setRegistrationMode] = useState(false)
  const [recognitionActive, setRecognitionActive] = useState(false)
  const [userName, setUserName] = useState('홍길동') // 기본 사용자 이름
  const [modelLoaded, setModelLoaded] = useState(false)
  const [registeredUsers, setRegisteredUsers] = useState([])
  const [matchResult, setMatchResult] = useState(null)

  const camera = useRef(null)
  const devices = useCameraDevices()
  const device = devices.front
  const ghostFaceNetModel = useRef(null)

  // 얼굴 인식 프레임워크 초기화
  const { faceDetector, detectFaces } = useFaceDetector()

  // 카메라 권한 요청 및 모델 로드
  useEffect(() => {
    ;(async () => {
      const cameraPermission = await Camera.requestCameraPermission()
      setHasPermission(cameraPermission === 'authorized')

      // 텐서플로우 초기화
      await tf.ready()

      // 모델 로드
      try {
        const model = await tf.loadLayersModel(bundleResourceIO(MODEL_JSON, MODEL_WEIGHTS))
        ghostFaceNetModel.current = model
        setModelLoaded(true)
        console.log('GhostFaceNets 모델 로드 완료')
      } catch (error) {
        console.error('모델 로드 실패:', error)
      }

      // 저장된 사용자 목록 불러오기
      loadRegisteredUsers()
    })()
  }, [])

  // 등록된 사용자 목록 로드
  const loadRegisteredUsers = async () => {
    try {
      const users = await AsyncStorage.getItem('registeredUsers')
      if (users) {
        setRegisteredUsers(JSON.parse(users))
      }
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error)
    }
  }

  // 얼굴 특징 추출 함수
  const extractFaceEmbedding = async (face) => {
    if (!ghostFaceNetModel.current) return null

    try {
      // 얼굴 영역 추출 및 전처리
      const processedFace = await preprocessImage(face)

      // 임베딩 추출
      const embedding = ghostFaceNetModel.current.predict(processedFace)
      const embeddingData = await embedding.data()

      // 텐서 정리
      tf.dispose([processedFace, embedding])

      return Array.from(embeddingData)
    } catch (error) {
      console.error('얼굴 특징 추출 실패:', error)
      return null
    }
  }

  // 얼굴 등록 함수
  const registerFace = async () => {
    if (!camera.current) return

    try {
      // 사진 촬영
      const photo = await camera.current.takePhoto({
        flash: 'off',
        qualityPrioritization: 'speed',
      })

      // 얼굴 감지
      const faces = await detectFaces(photo.path)

      if (faces.length === 0) {
        Alert.alert('오류', '얼굴이 감지되지 않았습니다. 다시 시도해주세요.')
        return
      }

      if (faces.length > 1) {
        Alert.alert('오류', '여러 얼굴이 감지되었습니다. 한 명만 포함되도록 다시 시도해주세요.')
        return
      }

      // 임베딩 추출
      const embedding = await extractFaceEmbedding({ uri: `file://${photo.path}` })
      if (!embedding) {
        Alert.alert('오류', '얼굴 특징 추출에 실패했습니다.')
        return
      }

      // 사용자 정보 저장
      const userData = { name: userName, embedding }
      const updatedUsers = [...registeredUsers, userData]

      await AsyncStorage.setItem(userName, JSON.stringify(embedding))
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(updatedUsers))

      setRegisteredUsers(updatedUsers)
      Alert.alert('성공', `${userName}님의 얼굴이 등록되었습니다.`)
      setRegistrationMode(false)
    } catch (error) {
      console.error('얼굴 등록 실패:', error)
      Alert.alert('오류', '얼굴 등록 중 오류가 발생했습니다.')
    }
  }

  // 실시간 얼굴 인식 처리 함수
  const handleFaces = async (faceData) => {
    if (!recognitionActive || registeredUsers.length === 0) return

    try {
      if (faceData.faces.length === 0) {
        setMatchResult(null)
        return
      }

      const face = faceData.faces[0]

      // 간단한 최적화: 얼굴이 너무 작으면 처리하지 않음
      if (face.bounds.width < 100 || face.bounds.height < 100) {
        return
      }

      // 임베딩 추출 (여기서는 실제 구현에서는 더 최적화 필요)
      const photo = await camera.current.takePhoto({
        flash: 'off',
        qualityPrioritization: 'speed',
      })

      const currentEmbedding = await extractFaceEmbedding({ uri: `file://${photo.path}` })
      if (!currentEmbedding) return

      // 모든 등록된 사용자와 비교
      let bestMatch = { name: null, similarity: 0 }

      for (const user of registeredUsers) {
        const similarity = cosineSimilarity(currentEmbedding, user.embedding)

        if (similarity > bestMatch.similarity) {
          bestMatch = { name: user.name, similarity }
        }
      }

      // 0.7 이상일 경우 매칭 성공으로 간주
      if (bestMatch.similarity >= 0.7) {
        setMatchResult({
          name: bestMatch.name,
          similarity: bestMatch.similarity,
          success: true,
        })
      } else {
        setMatchResult({
          name: '알 수 없음',
          similarity: bestMatch.similarity,
          success: false,
        })
      }
    } catch (error) {
      console.error('얼굴 인식 중 오류:', error)
    }
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>카메라 권한 요청 중...</Text>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>카메라 접근 권한이 없습니다.</Text>
      </View>
    )
  }

  if (!device || !modelLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>{!device ? '카메라 초기화 중...' : '얼굴 인식 모델 로딩 중...'}</Text>
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
        preset="low" // 480p 해상도 사용
        fps={15} // 프레임율 조정
        photo={true}
        faceDetectionMode="fast"
        faceDetectorSettings={{
          minFaceSize: 0.1,
          performanceMode: 'fast',
        }}
        onFacesDetected={handleFaces}
      />

      <View style={styles.controlsContainer}>
        {registrationMode ? (
          <TouchableOpacity style={styles.button} onPress={registerFace}>
            <Text style={styles.buttonText}>얼굴 등록하기</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: recognitionActive ? '#ff6666' : '#4CAF50' }]}
              onPress={() => setRecognitionActive(!recognitionActive)}>
              <Text style={styles.buttonText}>{recognitionActive ? '인식 중지' : '얼굴 인식 시작'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setRegistrationMode(true)}>
              <Text style={styles.buttonText}>등록 모드</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {matchResult && recognitionActive && (
        <View
          style={[styles.resultContainer, { backgroundColor: matchResult.success ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)' }]}>
          <Text style={styles.resultText}>{matchResult.success ? `${matchResult.name}님 환영합니다!` : '일치하는 사용자가 없습니다'}</Text>
          <Text style={styles.similarityText}>유사도: {(matchResult.similarity * 100).toFixed(1)}%</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  similarityText: {
    color: 'white',
    fontSize: 16,
    marginTop: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
})

export default App
